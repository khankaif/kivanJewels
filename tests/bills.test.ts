import test from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { recordBill, recordDirectSale, SettlementError } from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function party(c: any) {
  const { rows } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Bill ${uniq()}`]);
  return rows[0].id as string;
}

test('a charges-only purchase bill posts a payable and moves no stock', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c);
    const billNo = `ZZ-PB-${uniq()}`;
    await recordBill(
      { partyId: supplier, direction: 'purchase', amount: 5000, on: '2024-06-01', billNo,
        notes: 'brokerage' }, c);

    const { rows: [g] } = await c.query(
      `SELECT kind, amount, bill_no FROM ledger WHERE bill_no = $1`, [billNo]);
    assert.equal(g.kind, 'purchase_invoice');
    // Negative = we owe them. The ledger_sign constraint depends on this.
    assert.equal(Number(g.amount), -5000);

    const { rows: [b] } = await c.query(
      `SELECT direction, gross, balance FROM bills WHERE bill_key = $1`, [billNo]);
    assert.equal(b.direction, 'purchase');
    assert.equal(Number(b.gross), 5000);
    assert.equal(Number(b.balance), 5000);

    const { rows: moves } = await c.query(
      `SELECT 1 FROM movements WHERE ref_id = $1`, [billNo]);
    assert.equal(moves.length, 0, 'a charges bill must not touch stock');
  });
});

test('a charges-only sale bill posts a receivable', async () => {
  await inRollback(async (c) => {
    const client = await party(c);
    const billNo = `ZZ-SB-${uniq()}`;
    await recordBill(
      { partyId: client, direction: 'sale', amount: 1200, on: '2024-06-02', billNo }, c);

    const { rows: [g] } = await c.query(
      `SELECT kind, amount FROM ledger WHERE bill_no = $1`, [billNo]);
    assert.equal(g.kind, 'sale_invoice');
    assert.equal(Number(g.amount), 1200, 'positive = they owe us');
  });
});

test('a bill needs a number and a positive amount', async () => {
  await inRollback(async (c) => {
    const p = await party(c);
    await assert.rejects(
      () => recordBill({ partyId: p, direction: 'sale', amount: 0, on: '2024-06-02', billNo: 'X' }, c),
      SettlementError);
    await assert.rejects(
      () => recordBill({ partyId: p, direction: 'sale', amount: 10, on: '2024-06-02', billNo: '  ' }, c),
      SettlementError);
  });
});

test('a sale bill straight from stock needs no requirement behind it', async () => {
  await inRollback(async (c) => {
    const client = await party(c);
    const lotNo = `ZZ-BILL-LOT-${uniq()}`;
    const { rows: [lot] } = await c.query(
      `INSERT INTO lots (lot_no, stone_type, cost_rate, source, opened_on)
       VALUES ($1,'Lab Grown',4000,'purchase','2024-04-01') RETURNING id`, [lotNo]);
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
       VALUES ($1,'purchase',10,4000,40000,'2024-04-01')`, [lot.id]);

    const billNo = `ZZ-WALKIN-${uniq()}`;
    await recordDirectSale(
      { lotId: lot.id, carats: 4, rate: 6000, on: '2024-06-03', invoiceNo: billNo, partyId: client }, c);

    const { rows: [bal] } = await c.query(
      `SELECT balance FROM lot_balances WHERE lot_id = $1`, [lot.id]);
    assert.equal(Number(bal.balance), 6, '10 ct less the 4 ct sold');

    const { rows: [g] } = await c.query(
      `SELECT kind, amount FROM ledger WHERE bill_no = $1`, [billNo]);
    assert.equal(g.kind, 'sale_invoice');
    assert.equal(Number(g.amount), 24000, '4 ct at 6000');
  });
});
