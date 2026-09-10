import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import {
  recordDirectSale, recordPurchase, issueOutwardMemo, receiveInwardMemo,
  returnFromMemo, lotBalance, OverdrawError,
} from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function customer(c: any): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Cust ${uniq()}`]);
  return rows[0].id;
}
async function supplier(c: any): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Supp ${uniq()}`]);
  return rows[0].id;
}

/** A requirement with one line for a spec no real row collides with. */
async function requirement(c: any, partyId: string, want: number, over: Record<string, string> = {}) {
  const spec = { shape: 'Round', sieveSize: `ZZ-${uniq()}`, mmSize: '2.20', colour: 'EF', clarity: 'VVS-VS', ...over };
  const { rows: [r] } = await c.query(
    `INSERT INTO requirements (party_id, raised_on) VALUES ($1,'2024-06-01') RETURNING id`, [partyId]);
  const { rows: [l] } = await c.query(
    `INSERT INTO requirement_lines (requirement_id, shape, sieve_size, mm_size, colour, clarity, carats, quoted_rate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [r.id, spec.shape, spec.sieveSize, spec.mmSize, spec.colour, spec.clarity, want, 6000],
  );
  return { reqId: r.id as string, lineId: l.id as string, spec };
}

const status = async (c: any, lineId: string) =>
  (await c.query(`SELECT * FROM requirement_line_status WHERE line_id = $1`, [lineId])).rows[0];

/** Owned stock of a spec, so a delivery has something to come from. */
async function stockLot(c: any, spec: Record<string, string>, carats: number): Promise<string> {
  return recordPurchase({
    spec: { stoneType: 'Lab Grown', ...spec, sieveSize: spec.sieveSize, mmSize: spec.mmSize },
    carats, rate: 4000, on: '2024-05-01',
  }, c);
}

test('recordDirectSale decrements the lot, posts a receivable, and hits the overdraw guard', async () => {
  await inRollback(async (c) => {
    const cust = await customer(c);
    const { lineId, spec } = await requirement(c, cust, 5);
    const lot = await stockLot(c, spec, 3);

    await recordDirectSale({
      lotId: lot, carats: 3, rate: 6500, on: '2024-06-02',
      invoiceNo: `ZZ-S-${uniq()}`, partyId: cust, requirementLineId: lineId,
    }, c);

    assert.equal(await lotBalance(lot, c), 0, 'carats left the vault');
    const { rows: led } = await c.query(
      `SELECT kind, amount FROM ledger WHERE party_id = $1`, [cust]);
    assert.equal(led[0].kind, 'sale_invoice');
    assert.equal(Number(led[0].amount), 19500, 'receivable is positive: they owe us');

    await assert.rejects(
      recordDirectSale({
        lotId: lot, carats: 1, rate: 6500, on: '2024-06-03',
        invoiceNo: `ZZ-S-${uniq()}`, partyId: cust,
      }, c),
      OverdrawError,
    );
  });
});

test('requirement_line_status: wanted - delivered = outstanding, direct-sale channel', async () => {
  await inRollback(async (c) => {
    const cust = await customer(c);
    const { lineId, spec } = await requirement(c, cust, 5);
    const lot = await stockLot(c, spec, 10);

    let st = await status(c, lineId);
    assert.equal(Number(st.wanted), 5);
    assert.equal(Number(st.outstanding), 5, 'nothing delivered yet');

    await recordDirectSale({
      lotId: lot, carats: 2, rate: 6000, on: '2024-06-02',
      invoiceNo: `ZZ-S-${uniq()}`, partyId: cust, requirementLineId: lineId,
    }, c);
    st = await status(c, lineId);
    assert.equal(Number(st.delivered_direct), 2);
    assert.equal(Number(st.outstanding), 3);
  });
});

test('memo delivery counts net of client returns; a return raises outstanding again', async () => {
  await inRollback(async (c) => {
    const cust = await customer(c);
    const { lineId, spec } = await requirement(c, cust, 5);
    const lot = await stockLot(c, spec, 10);

    await issueOutwardMemo({
      memoNo: `ZZ-OUT-${uniq()}`, partyId: cust, issuedOn: '2024-06-02', dueOn: '2024-06-09',
      requirementLineId: lineId, lines: [{ lotId: lot, carats: 5, rate: 6000 }],
    }, c);
    let st = await status(c, lineId);
    assert.equal(Number(st.delivered_memo), 5);
    assert.equal(Number(st.outstanding), 0);

    const { rows: [ml] } = await c.query(
      `SELECT id FROM memo_lines WHERE requirement_line_id = $1`, [lineId]);
    await returnFromMemo({ memoLineId: ml.id, carats: 2, on: '2024-06-05' }, c);

    st = await status(c, lineId);
    assert.equal(Number(st.delivered_memo), 3, 'two carats came back');
    assert.equal(Number(st.outstanding), 2, 'the line needs work again');
  });
});

test('back-to-back: source inward memo and deliver outward memo, both linked', async () => {
  await inRollback(async (c) => {
    const cust = await customer(c);
    const supp = await supplier(c);
    const { lineId, spec } = await requirement(c, cust, 6);

    // Nothing in stock. Source 6 ct on a supplier memo, linked to the requirement.
    const inMemo = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supp, issuedOn: '2024-06-02',
      requirementLineId: lineId,
      lines: [{ carats: 6, rate: 5000, stoneType: 'Lab Grown', ...spec }],
    }, c);
    const { rows: [inLine] } = await c.query(
      `SELECT id, lot_id FROM memo_lines WHERE memo_id = $1`, [inMemo]);

    let st = await status(c, lineId);
    assert.equal(Number(st.sourced_pending), 6, 'in hand, not yet delivered');
    assert.equal(Number(st.outstanding), 6);

    // Straight out to the customer on a memo.
    await issueOutwardMemo({
      memoNo: `ZZ-OUT-${uniq()}`, partyId: cust, issuedOn: '2024-06-03', dueOn: '2024-06-10',
      requirementLineId: lineId, lines: [{ lotId: inLine.lot_id, carats: 6, rate: 6500 }],
    }, c);

    st = await status(c, lineId);
    assert.equal(Number(st.delivered_memo), 6);
    assert.equal(Number(st.outstanding), 0, 'requirement met, neither side billed yet');
    assert.equal(await lotBalance(inLine.lot_id, c), 0, 'the parcel is with the customer');
  });
});

test('over-delivery drives outstanding negative without erroring', async () => {
  await inRollback(async (c) => {
    const cust = await customer(c);
    const { lineId, spec } = await requirement(c, cust, 5);
    const lot = await stockLot(c, spec, 10);

    await recordDirectSale({
      lotId: lot, carats: 6, rate: 6000, on: '2024-06-02',
      invoiceNo: `ZZ-S-${uniq()}`, partyId: cust, requirementLineId: lineId,
    }, c);
    const st = await status(c, lineId);
    assert.equal(Number(st.outstanding), -1);
  });
});
