import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import {
  recordPurchase, receiveInwardMemo, billMemoLine, lotBalance,
} from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/** A spec no other test or real row can collide with. */
const spec = (over: Record<string, unknown> = {}) => ({
  stoneType: 'Lab Grown', shape: 'Round', sieveSize: `ZZ-${uniq()}`, mmSize: '2.20mm',
  ...over,
});

const lotOf = async (c: any, id: string) =>
  (await c.query(`SELECT lot_no, source, cost_rate, unit_key FROM lots WHERE id = $1`, [id])).rows[0];

test('the same spec bought twice is ONE unit, priced value / weight', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const first = await recordPurchase({ spec: s, carats: 2, rate: 4500, on: '2024-05-01' }, c);
    // Same stone, spelled the way the source actually spells it.
    const second = await recordPurchase(
      { spec: { ...s, shape: 'RBC', mmSize: '2.20 MM' }, carats: 2, rate: 5000, on: '2024-05-02' },
      c,
    );

    assert.equal(second, first, 'second purchase lands in the unit that already exists');
    assert.equal(await lotBalance(first, c), 4);
    const lot = await lotOf(c, first);
    assert.equal(Number(lot.cost_rate), 4750, '(2*4500 + 2*5000) / 4');
    assert.equal(lot.source, 'unit');
  });
});

test('a different shape is a different unit', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const round = await recordPurchase({ spec: s, carats: 1, rate: 4000, on: '2024-05-01' }, c);
    const pear = await recordPurchase(
      { spec: { ...s, shape: 'Pear' }, carats: 1, rate: 4000, on: '2024-05-01' }, c);
    assert.notEqual(pear, round, 'Pear 2.20mm is not Round 2.20mm');
  });
});

test('a different colour or clarity is a different unit, priced on its own', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const ef = await recordPurchase(
      { spec: { ...s, colour: 'EF', clarity: 'VVS-VS' }, carats: 2, rate: 5000, on: '2024-05-01' }, c);
    const gh = await recordPurchase(
      { spec: { ...s, colour: 'GH', clarity: 'SI' }, carats: 2, rate: 3800, on: '2024-05-01' }, c);
    // Same colour spelled differently should still land on the EF unit.
    const efAgain = await recordPurchase(
      { spec: { ...s, colour: 'ef', clarity: 'vvs-vs' }, carats: 2, rate: 6000, on: '2024-05-02' }, c);

    assert.notEqual(gh, ef, 'GH/SI stock does not blend into the EF/VVS-VS unit');
    assert.equal(efAgain, ef, 'case does not create a third unit');
    assert.equal(Number((await lotOf(c, ef)).cost_rate), 5500, '(2*5000 + 2*6000) / 4, not touched by GH');
    assert.equal(Number((await lotOf(c, gh)).cost_rate), 3800);
  });
});

test('a purchase on a bill posts a payable; one without does not', async () => {
  await inRollback(async (c) => {
    const { rows: [supplier] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Supplier ${uniq()}`]);
    const billNo = `ZZ-B-${uniq()}`;

    await recordPurchase(
      { spec: spec(), carats: 2, rate: 5000, on: '2024-05-01', partyId: supplier.id, billNo }, c);
    await recordPurchase({ spec: spec(), carats: 2, rate: 5000, on: '2024-05-01' }, c);

    const { rows } = await c.query(
      `SELECT kind, amount FROM ledger WHERE party_id = $1`, [supplier.id]);
    assert.equal(rows.length, 1, 'cash purchases owe nobody');
    assert.equal(rows[0].kind, 'purchase_invoice');
    assert.equal(Number(rows[0].amount), -10000, 'payable is negative: we owe them');
  });
});

test('billing an inward memo moves the carats into the owned unit', async () => {
  await inRollback(async (c) => {
    const { rows: [supplier] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Supplier ${uniq()}`]);
    const s = spec();
    // Stock of this spec is already owned, bought earlier at a different rate.
    const unit = await recordPurchase({ spec: s, carats: 2, rate: 4000, on: '2024-05-01' }, c);

    const memoId = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier.id, issuedOn: '2024-05-02',
      lines: [{ carats: 6, rate: 5000, ...s }],
    }, c);
    const { rows: [line] } = await c.query(
      `SELECT id, lot_id FROM memo_lines WHERE memo_id = $1`, [memoId]);
    assert.notEqual(line.lot_id, unit, 'memo goods are held, not owned');

    await billMemoLine({ memoLineId: line.id, carats: 6, on: '2024-05-08', invoiceNo: `ZZ-P-${uniq()}` }, c);

    assert.equal(await lotBalance(line.lot_id, c), 0, 'the parcel is no longer held on memo');
    assert.equal(await lotBalance(unit, c), 8, 'it is owned stock now, in the one unit');
    assert.equal(Number((await lotOf(c, unit)).cost_rate), 4750, '(2*4000 + 6*5000) / 8');
  });
});

test('back-to-back: goods sold onward before purchase leave nothing to own', async () => {
  await inRollback(async (c) => {
    const { rows: [supplier] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Supplier ${uniq()}`]);
    const s = spec();
    const memoId = await receiveInwardMemo({
      memoNo: `ZZ-IN-${uniq()}`, partyId: supplier.id, issuedOn: '2024-05-02',
      lines: [{ carats: 6, rate: 5000, ...s }],
    }, c);
    const { rows: [line] } = await c.query(
      `SELECT id, lot_id FROM memo_lines WHERE memo_id = $1`, [memoId]);

    // Straight out of the door: sold to a client before the supplier billed us.
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
       VALUES ($1,'sale',-6,6000,36000,'2024-05-03')`, [line.lot_id]);

    await billMemoLine({ memoLineId: line.id, carats: 6, on: '2024-05-08', invoiceNo: `ZZ-P-${uniq()}` }, c);

    const { rows } = await c.query(
      `SELECT id FROM lots WHERE source = 'unit'
         AND unit_key = lot_unit_key($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.stoneType, s.shape, s.sieveSize, s.mmSize, null, null, null, null]);
    assert.equal(rows.length, 0, 'nothing was left to move into stock');
  });
});

test('lab grown and natural of one spec are different units, never averaged', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const lab = await recordPurchase({ spec: s, carats: 2, rate: 4500, on: '2024-05-01' }, c);
    const nat = await recordPurchase(
      { spec: { ...s, stoneType: 'Natural' }, carats: 2, rate: 90000, on: '2024-05-02' }, c);

    assert.notEqual(nat, lab, 'a natural stone must not land in the lab-grown unit');
    assert.equal(Number((await lotOf(c, lab)).cost_rate), 4500);
    assert.equal(Number((await lotOf(c, nat)).cost_rate), 90000);
  });
});

test('certification is identity: certified, uncertified and each lab stand apart', async () => {
  await inRollback(async (c) => {
    const s = spec();
    const plain = await recordPurchase(
      { spec: { ...s, certified: 'Non-certified' }, carats: 1, rate: 4000, on: '2024-05-01' }, c);
    const igi = await recordPurchase(
      { spec: { ...s, certified: 'Certified', lab: 'IGI' }, carats: 1, rate: 6000, on: '2024-05-02' }, c);
    const hrd = await recordPurchase(
      { spec: { ...s, certified: 'Certified', lab: 'HRD' }, carats: 1, rate: 6500, on: '2024-05-03' }, c);

    assert.equal(new Set([plain, igi, hrd]).size, 3);
    // Same certificate, same unit -- casing is normalized like every other field.
    const again = await recordPurchase(
      { spec: { ...s, certified: 'certified', lab: 'igi' }, carats: 1, rate: 6200, on: '2024-05-04' }, c);
    assert.equal(again, igi);
    assert.equal(Number((await lotOf(c, igi)).cost_rate), 6100, '(6000 + 6200) / 2');
  });
});
