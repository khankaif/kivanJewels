import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { recordPayment, SettlementError } from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function partyWithBill(c: any, gross: number, direction: 'sale' | 'purchase') {
  const billNo = `ZZ-B-${uniq()}`;
  const { rows: [p] } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Pay ${uniq()}`]);
  await c.query(
    `INSERT INTO ledger (party_id, kind, amount, dated_on, bill_no, ref_type, ref_id)
     VALUES ($1,$2,$3,'2024-06-01',$4,'test',$4)`,
    [p.id, direction === 'sale' ? 'sale_invoice' : 'purchase_invoice',
     direction === 'sale' ? gross : -gross, billNo]);
  return { partyId: p.id as string, billNo };
}
const billBalance = async (c: any, partyId: string, billNo: string, direction: string) =>
  Number((await c.query(
    `SELECT balance FROM bills WHERE party_id=$1 AND bill_no=$2 AND direction=$3`,
    [partyId, billNo, direction])).rows[0].balance);

test('a receipt against a bill reduces that bill balance', async () => {
  await inRollback(async (c) => {
    const { partyId, billNo } = await partyWithBill(c, 10000, 'sale');
    assert.equal(await billBalance(c, partyId, billNo, 'sale'), 10000);

    await recordPayment({ partyId, direction: 'in', amount: 4000, on: '2024-06-10',
      billNo, mode: 'bank', notes: 'UTR123' }, c);

    assert.equal(await billBalance(c, partyId, billNo, 'sale'), 6000);
    const { rows } = await c.query(
      `SELECT kind, amount, mode, notes FROM ledger WHERE party_id=$1 AND kind='payment_in'`, [partyId]);
    assert.equal(Number(rows[0].amount), -4000, 'a receipt is negative: it reduces what they owe');
    assert.equal(rows[0].mode, 'bank');
  });
});

test('paying a supplier bill reduces the payable', async () => {
  await inRollback(async (c) => {
    const { partyId, billNo } = await partyWithBill(c, 8000, 'purchase');
    await recordPayment({ partyId, direction: 'out', amount: 8000, on: '2024-06-10', billNo }, c);
    assert.equal(await billBalance(c, partyId, billNo, 'purchase'), 0);
    const { rows } = await c.query(
      `SELECT net FROM party_balances WHERE party_id=$1`, [partyId]);
    assert.equal(Number(rows[0].net), 0, 'invoice and payment cancel out');
  });
});

test('overpaying a bill is refused with the actual balance in the message', async () => {
  await inRollback(async (c) => {
    const { partyId, billNo } = await partyWithBill(c, 10000, 'sale');
    await recordPayment({ partyId, direction: 'in', amount: 9000, on: '2024-06-10', billNo }, c);
    await assert.rejects(
      () => recordPayment({ partyId, direction: 'in', amount: 5000, on: '2024-06-11', billNo }, c),
      (e: Error) => e instanceof SettlementError && /exceeds the 1000.00 outstanding/.test(e.message),
    );
    assert.equal(await billBalance(c, partyId, billNo, 'sale'), 1000, 'balance untouched');
  });
});

test('an on-account payment is allowed with no bill and moves the party balance', async () => {
  await inRollback(async (c) => {
    const { partyId } = await partyWithBill(c, 10000, 'sale');
    await recordPayment({ partyId, direction: 'in', amount: 25000, on: '2024-06-10' }, c);
    const { rows } = await c.query(`SELECT net FROM party_balances WHERE party_id=$1`, [partyId]);
    assert.equal(Number(rows[0].net), -15000, 'advance leaves us owing them');
  });
});

test('zero and negative payments are refused', async () => {
  await inRollback(async (c) => {
    const { partyId } = await partyWithBill(c, 100, 'sale');
    for (const amount of [0, -50]) {
      await assert.rejects(
        () => recordPayment({ partyId, direction: 'in', amount, on: '2024-06-10' }, c),
        SettlementError);
    }
  });
});

test('partial payments accumulate across several receipts', async () => {
  await inRollback(async (c) => {
    const { partyId, billNo } = await partyWithBill(c, 9000, 'sale');
    for (const amt of [3000, 3000, 3000]) {
      await recordPayment({ partyId, direction: 'in', amount: amt, on: '2024-06-10', billNo }, c);
    }
    assert.equal(await billBalance(c, partyId, billNo, 'sale'), 0);
  });
});
