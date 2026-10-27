import test from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { recordBill, recordPayment } from '@/lib/ledger/movements';
import { addDays, todayIso } from '@/lib/dates';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const today = todayIso();

async function party(c: any) {
  const { rows } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Due ${uniq()}`]);
  return rows[0].id as string;
}

const billRow = async (c: any, billNo: string) =>
  (await c.query(
    `SELECT due_on, days_overdue, status, lines, gross, balance FROM bills WHERE bill_key = $1`,
    [billNo])).rows[0];

test('a bill within terms is due, and overdue once the date passes', async () => {
  await inRollback(async (c) => {
    const client = await party(c);

    const future = `ZZ-DUE-${uniq()}`;
    await recordBill({ partyId: client, direction: 'sale', amount: 1000, on: today,
                       billNo: future, dueOn: addDays(today, 7) }, c);
    const soon = await billRow(c, future);
    assert.equal(soon.status, 'due');
    assert.equal(Number(soon.days_overdue), -7);

    const late = `ZZ-LATE-${uniq()}`;
    await recordBill({ partyId: client, direction: 'sale', amount: 1000, on: addDays(today, -30),
                       billNo: late, dueOn: addDays(today, -3) }, c);
    const overdue = await billRow(c, late);
    assert.equal(overdue.status, 'overdue');
    assert.equal(Number(overdue.days_overdue), 3);
  });
});

test('status follows the payments already in the ledger', async () => {
  await inRollback(async (c) => {
    const client = await party(c);
    const billNo = `ZZ-PART-${uniq()}`;
    await recordBill({ partyId: client, direction: 'sale', amount: 1000, on: today,
                       billNo, dueOn: addDays(today, 10) }, c);

    await recordPayment({ partyId: client, direction: 'in', amount: 400, on: today, billNo }, c);
    assert.equal((await billRow(c, billNo)).status, 'part');

    await recordPayment({ partyId: client, direction: 'in', amount: 600, on: today, billNo }, c);
    const settled = await billRow(c, billNo);
    assert.equal(settled.status, 'paid');
    assert.equal(Number(settled.balance), 0);
  });
});

test('several lines under one bill number stay one document', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c);
    const billNo = `ZZ-MULTI-${uniq()}`;
    const due = addDays(today, 15);
    for (const amount of [1500, 2500]) {
      await recordBill({ partyId: supplier, direction: 'purchase', amount, on: today, billNo, dueOn: due }, c);
    }
    const bill = await billRow(c, billNo);
    assert.equal(bill.lines, 2);
    assert.equal(Number(bill.gross), 4000);
    assert.equal(bill.due_on, due);
  });
});
