import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import {
  receiveInwardMemo, issueOutwardMemo, returnFromMemo, billMemoLine,
  memoLineOutstanding, lotBalance, OverdrawError, SettlementError,
} from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function party(c: any, name: string, terms = 7): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO parties (name, default_terms_days) VALUES ($1,$2) RETURNING id`,
    [`ZZ ${name} ${uniq()}`, terms],
  );
  return rows[0].id;
}
const lineOf = async (c: any, memoId: string) =>
  (await c.query(`SELECT id, lot_id FROM memo_lines WHERE memo_id = $1`, [memoId])).rows[0];

test('receiving an inward memo adds carats WITHOUT creating a payable', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c, 'Supplier');
    const memoId = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01',
      lines: [{ carats: 10, rate: 3800, stoneType: 'Lab Grown', sieveSize: '6.5-7' }],
    }, c);
    const line = await lineOf(c, memoId);

    assert.equal(await lotBalance(line.lot_id, c), 10, 'consignment goods are in the vault');

    const { rows: led } = await c.query(
      `SELECT count(*)::int n FROM ledger WHERE party_id = $1`, [supplier]);
    assert.equal(led[0].n, 0, 'no payable until the vendor bills');

    const { rows: lot } = await c.query(`SELECT source FROM lots WHERE id = $1`, [line.lot_id]);
    assert.equal(lot[0].source, 'memo_in', 'held on consignment, not owned');
  });
});

test('due date defaults to the party terms (source: Due = Pur.Date + Terms)', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c, 'Supplier', 15);
    const memoId = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01',
      lines: [{ carats: 1, rate: 3800, stoneType: 'Lab Grown' }],
    }, c);
    // due_on::text — a calendar date must never travel as a timestamp. Read as a
    // JS Date it comes back at LOCAL midnight, and .toISOString() then reports
    // the previous day in any positive-offset zone such as IST.
    const { rows } = await c.query(
      `SELECT due_on::text AS due_on, terms_days FROM memos WHERE id = $1`, [memoId]);
    assert.equal(rows[0].terms_days, 15);
    assert.equal(rows[0].due_on, '2024-05-16');
  });
});

test('vendor billing creates a PAYABLE and promotes the lot to owned stock', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c, 'Supplier');
    const invoiceNo = `ZZ-PINV-${uniq()}`;
    const memoId = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01',
      lines: [{ carats: 10, rate: 3800, stoneType: 'Lab Grown' }],
    }, c);
    const line = await lineOf(c, memoId);

    await billMemoLine({ memoLineId: line.id, carats: 10, on: '2024-05-08', invoiceNo }, c);

    assert.equal(await lotBalance(line.lot_id, c), 10, 'billing moves no carats: already in vault');

    const { rows: led } = await c.query(
      `SELECT kind, amount FROM ledger WHERE ref_id = $1`, [invoiceNo]);
    assert.equal(led[0].kind, 'purchase_invoice');
    assert.equal(Number(led[0].amount), -38000, 'payable is negative: we owe them');

    const { rows: lot } = await c.query(`SELECT source, cost_rate FROM lots WHERE id = $1`, [line.lot_id]);
    assert.equal(lot[0].source, 'purchase', 'promoted from consignment to owned');
    assert.equal(Number(lot[0].cost_rate), 3800);
  });
});

test('returning to the vendor removes carats from the vault', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c, 'Supplier');
    const memoId = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01',
      lines: [{ carats: 10, rate: 3800, stoneType: 'Lab Grown' }],
    }, c);
    const line = await lineOf(c, memoId);

    await returnFromMemo({ memoLineId: line.id, carats: 4, on: '2024-05-05' }, c);
    assert.equal(await lotBalance(line.lot_id, c), 6, 'returned goods leave the vault');
    assert.equal(await memoLineOutstanding(line.id, c), 6);
  });
});

test('BACK-TO-BACK: supplier memo -> client memo before purchase -> both sides bill', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c, 'Naice');
    const client = await party(c, 'CarpeDiam');
    const purInv = `ZZ-P-${uniq()}`;
    const saleInv = `ZZ-S-${uniq()}`;

    // 1. goods arrive from supplier on memo, not yet bought
    const inMemo = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01', agent: 'Rushabh',
      lines: [{ carats: 10, rate: 3800, stoneType: 'Lab Grown', sieveSize: '6.5-7' }],
    }, c);
    const inLine = await lineOf(c, inMemo);
    assert.equal(await lotBalance(inLine.lot_id, c), 10);

    // 2. straight out to the client on approval, still unpurchased
    const outMemo = await issueOutwardMemo({
      memoNo: `ZZ-OUT-${uniq()}`, partyId: client, issuedOn: '2024-05-02',
      dueOn: '2024-05-09', agent: 'Rushabh',
      lines: [{ lotId: inLine.lot_id, carats: 6, rate: 4800 }],
    }, c);
    const outLine = await lineOf(c, outMemo);
    assert.equal(await lotBalance(inLine.lot_id, c), 4, 'six carats are with the client');

    // 3. client keeps 6 -> receivable
    await billMemoLine({ memoLineId: outLine.id, carats: 6, on: '2024-05-05', invoiceNo: saleInv }, c);
    // 4. we return 4 to the supplier and are billed for the 6 we kept
    await returnFromMemo({ memoLineId: inLine.id, carats: 4, on: '2024-05-06' }, c);
    await billMemoLine({ memoLineId: inLine.id, carats: 6, on: '2024-05-06', invoiceNo: purInv }, c);

    assert.equal(await lotBalance(inLine.lot_id, c), 0, 'nothing left: 6 sold, 4 returned');
    assert.equal(await memoLineOutstanding(inLine.id, c), 0);
    assert.equal(await memoLineOutstanding(outLine.id, c), 0);

    const { rows: money } = await c.query(
      `SELECT kind, amount FROM ledger WHERE ref_id = ANY($1) ORDER BY kind`, [[purInv, saleInv]]);
    assert.deepEqual(
      money.map((m: any) => [m.kind, Number(m.amount)]),
      [['purchase_invoice', -22800], ['sale_invoice', 28800]],
      '6 ct bought at 3800 and sold at 4800',
    );

    const { rows: memos } = await c.query(
      `SELECT direction, status FROM memos WHERE id = ANY($1) ORDER BY direction`, [[inMemo, outMemo]]);
    assert.deepEqual(memos.map((m: any) => [m.direction, m.status]), [['in', 'closed'], ['out', 'closed']]);
  });
});

test('cannot return to the vendor what has already been issued onward', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c, 'Supplier');
    const client = await party(c, 'Client');
    const inMemo = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01',
      lines: [{ carats: 10, rate: 3800, stoneType: 'Lab Grown' }],
    }, c);
    const inLine = await lineOf(c, inMemo);
    await issueOutwardMemo({
      memoNo: `ZZ-OUT-${uniq()}`, partyId: client, issuedOn: '2024-05-02', dueOn: null,
      lines: [{ lotId: inLine.lot_id, carats: 8, rate: 4800 }],
    }, c);

    // The memo line still shows 10 outstanding, but only 2 ct remain in the vault.
    assert.equal(await memoLineOutstanding(inLine.id, c), 10);
    await assert.rejects(
      () => returnFromMemo({ memoLineId: inLine.id, carats: 10, on: '2024-05-03' }, c),
      OverdrawError,
      'the vault guard must stop a return of goods that are with a client',
    );
  });
});

test('inward memo rejects empty lines and bad quantities', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c, 'Supplier');
    await assert.rejects(() => receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01', lines: [],
    }, c), SettlementError);
    await assert.rejects(() => receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01',
      lines: [{ carats: 0, rate: 100, stoneType: 'Lab Grown' }],
    }, c), SettlementError);
  });
});
