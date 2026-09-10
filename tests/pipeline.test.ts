import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { issueOutwardMemo, recordPurchase, billMemoLine } from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const spec = () => ({
  stoneType: 'Lab Grown', shape: 'Round', sieveSize: `ZZ-${uniq()}`, mmSize: '2.20',
  colour: 'EF', clarity: 'VVS-VS',
});

async function requirement(c: any, want: number, s: ReturnType<typeof spec>) {
  const { rows: [p] } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Pipe ${uniq()}`]);
  const { rows: [r] } = await c.query(
    `INSERT INTO requirements (party_id, raised_on) VALUES ($1, CURRENT_DATE) RETURNING id, requirement_no`,
    [p.id]);
  const { rows: [l] } = await c.query(
    `INSERT INTO requirement_lines
       (requirement_id, stone_type, shape, sieve_size, mm_size, colour, clarity, carats, quoted_rate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,6000) RETURNING id`,
    [r.id, s.stoneType, s.shape, s.sieveSize, s.mmSize, s.colour, s.clarity, want]);
  return { partyId: p.id as string, reqId: r.id as string, lineId: l.id as string };
}

const stageOf = async (c: any, reqId: string) =>
  (await c.query(`SELECT stage, on_approval, outstanding FROM requirement_pipeline WHERE id = $1`,
                 [reqId])).rows[0];

test('a requirement with no matching stock is new, and ready once stock exists', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const { reqId } = await requirement(c, 5, s);
    assert.equal((await stageOf(c, reqId)).stage, 'new');

    await recordPurchase({ spec: s, carats: 8, rate: 4000, on: '2024-06-01' }, c);
    assert.equal((await stageOf(c, reqId)).stage, 'ready');
  });
});

test('carats with the customer read as on approval, and stop once they are billed', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const { reqId, partyId, lineId } = await requirement(c, 5, s);
    const lotId = await recordPurchase({ spec: s, carats: 5, rate: 4000, on: '2024-06-01' }, c);

    await issueOutwardMemo({
      memoNo: `ZZ-OUT-${uniq()}`, partyId, issuedOn: '2024-06-02', dueOn: null,
      lines: [{ lotId, carats: 5, rate: 6000, requirementLineId: lineId }],
    }, c);

    const out = await stageOf(c, reqId);
    assert.equal(out.stage, 'approval');
    assert.equal(Number(out.on_approval), 5);

    // Billed: the goods are the customer's now, so nothing is on approval and
    // nothing is left to fill. This is the case a delivered-carats count gets
    // wrong -- it would keep the requirement on the board forever.
    const { rows: [ml] } = await c.query(
      `SELECT id FROM memo_lines WHERE requirement_line_id = $1`, [lineId]);
    await billMemoLine({ memoLineId: ml.id, carats: 5, on: '2024-06-09', invoiceNo: `ZZ-INV-${uniq()}` }, c);

    const done = await stageOf(c, reqId);
    assert.equal(Number(done.on_approval), 0);
    assert.equal(done.stage, 'closed');
  });
});
