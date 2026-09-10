import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import {
  billMemoLine, issueOutwardMemo, recordDirectSale, recordPayment, recordPurchase, recordBill,
} from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const spec = () => ({
  stoneType: 'Lab Grown', shape: 'Round', sieveSize: `ZZ-${uniq()}`, mmSize: '2.20',
  colour: 'EF', clarity: 'VVS-VS',
});

async function party(c: any) {
  const { rows } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Funnel ${uniq()}`]);
  return rows[0].id as string;
}

async function requirementLine(c: any, partyId: string, carats: number, s: ReturnType<typeof spec>) {
  const { rows: [r] } = await c.query(
    `INSERT INTO requirements (party_id, raised_on) VALUES ($1, CURRENT_DATE) RETURNING id, requirement_no`,
    [partyId]);
  const { rows: [l] } = await c.query(
    `INSERT INTO requirement_lines
       (requirement_id, stone_type, shape, sieve_size, mm_size, colour, clarity, carats, quoted_rate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,6000) RETURNING id`,
    [r.id, s.stoneType, s.shape, s.sieveSize, s.mmSize, s.colour, s.clarity, carats]);
  return { requirementId: r.id as string, requirementNo: r.requirement_no as string, lineId: l.id as string };
}

test('requirement to memo to invoice to payment is one linked chain', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const customer = await party(c);
    const { requirementNo, lineId } = await requirementLine(c, customer, 5, s);
    const lotId = await recordPurchase({ spec: s, carats: 5, rate: 4000, on: '2024-06-01' }, c);

    await issueOutwardMemo({
      memoNo: `ZZ-OUT-${uniq()}`, partyId: customer, issuedOn: '2024-06-02', dueOn: null,
      lines: [{ lotId, carats: 5, rate: 6000, requirementLineId: lineId }],
    }, c);
    const { rows: [ml] } = await c.query(
      `SELECT id FROM memo_lines WHERE requirement_line_id = $1`, [lineId]);

    const invoiceNo = `ZZ-INV-${uniq()}`;
    await billMemoLine({ memoLineId: ml.id, carats: 5, on: '2024-06-09', invoiceNo }, c);

    // The invoice is a real document: numbered, dated, and payable.
    const { rows: [bill] } = await c.query(
      `SELECT bill_no, due_on, gross, balance, status FROM bills WHERE bill_key = $1`, [invoiceNo]);
    assert.equal(bill.bill_no, invoiceNo, 'a memo billing must carry its bill number');
    assert.ok(bill.due_on, 'and a due date, from the party terms');
    assert.equal(Number(bill.gross), 30000);

    // And it knows what produced it, without matching on text.
    const { rows: [trail] } = await c.query(
      `SELECT memo_no, requirement_no, lot_no FROM bill_trail WHERE bill_no = $1`, [invoiceNo]);
    assert.ok(trail.memo_no, 'the invoice points back at its memo');
    assert.equal(trail.requirement_no, requirementNo);
    assert.ok(trail.lot_no);

    await recordPayment({ partyId: customer, direction: 'in', amount: 30000, on: '2024-07-01', billNo: invoiceNo }, c);
    const { rows: [settled] } = await c.query(
      `SELECT balance, status FROM bills WHERE bill_key = $1`, [invoiceNo]);
    assert.equal(Number(settled.balance), 0);
    assert.equal(settled.status, 'paid');
  });
});

test('a direct sale carries its lot and its requirement line', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const customer = await party(c);
    const { lineId } = await requirementLine(c, customer, 2, s);
    const lotId = await recordPurchase({ spec: s, carats: 2, rate: 4000, on: '2024-06-01' }, c);
    const invoiceNo = `ZZ-DS-${uniq()}`;

    await recordDirectSale({
      lotId, carats: 2, rate: 7000, on: '2024-06-03', invoiceNo,
      partyId: customer, requirementLineId: lineId,
    }, c);

    const { rows: [g] } = await c.query(
      `SELECT lot_id, requirement_line_id FROM ledger WHERE bill_no = $1`, [invoiceNo]);
    assert.equal(g.lot_id, lotId);
    assert.equal(g.requirement_line_id, lineId);
  });
});

test('an invoice with no goods and no charges flag is refused', async () => {
  // A rejected statement poisons its transaction, so this stands alone: the
  // charges case that must still succeed is the test below.
  await inRollback(async (c) => {
    const customer = await party(c);
    await assert.rejects(
      c.query(
        `INSERT INTO ledger (party_id, kind, amount, dated_on, bill_no)
         VALUES ($1,'sale_invoice',5000,CURRENT_DATE,'ZZ-NOWHERE')`, [customer]),
      /ledger_goods_backed/,
      'a bill claiming goods must point at the goods',
    );
  });
});

test('charges with nothing behind them stay legitimate -- they just say so', async () => {
  await inRollback(async (c) => {
    const customer = await party(c);
    const billNo = `ZZ-CHG-${uniq()}`;
    await recordBill({
      partyId: customer, direction: 'sale', amount: 5000, on: '2024-06-01',
      billNo, notes: 'brokerage',
    }, c);
    const { rows: [g] } = await c.query(`SELECT ref_type FROM ledger WHERE bill_no = $1`, [billNo]);
    assert.equal(g.ref_type, 'bill');
  });
});

test('billing an inward memo keeps certification out of the wrong unit', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c);
    const s = spec();
    const { receiveInwardMemo } = await import('@/lib/ledger/movements');
    const memoNo = `ZZ-IN-${uniq()}`;
    await receiveInwardMemo({
      memoNo, partyId: supplier, issuedOn: '2024-06-01',
      lines: [{ carats: 3, rate: 5000, ...s, certified: 'Certified', lab: 'IGI' }],
    }, c);
    const { rows: [ml] } = await c.query(
      `SELECT ml.id FROM memo_lines ml JOIN memos m ON m.id = ml.memo_id WHERE m.memo_no = $1`, [memoNo]);

    await billMemoLine({ memoLineId: ml.id, carats: 3, on: '2024-06-10', invoiceNo: `ZZ-PB-${uniq()}` }, c);

    const { rows: units } = await c.query(
      `SELECT certified, lab FROM lots WHERE source = 'unit' AND sieve_size = $1`, [s.sieveSize]);
    assert.equal(units.length, 1);
    assert.equal(units[0].certified, 'Certified', 'owned unit keeps the certification');
    assert.equal(units[0].lab, 'IGI');
  });
});
