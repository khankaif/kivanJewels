import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, planPrices, priceKey } from '../features/masters/prices/grid';

const ctx = (saved: [string, number][] = []) => ({
  stoneTypes: [{ name: 'Lab Grown', code: 'LGD' }, { name: 'Natural', code: 'ND' }],
  sizeIds: new Set(['RBC-1.3', 'RBC-6.4']),
  qualities: [
    { colour: 'EF', clarity: 'VVS-VS', active: true },
    { colour: 'EF', clarity: 'VS-SI', active: true },
    { colour: 'GH', clarity: 'SI', active: false },
  ],
  saved: new Map(saved),
});
const k = (t: string, s: string, c: string, cl: string) => priceKey({ stone_type: t, size_id: s, colour: c, clarity: cl });

test('prices: commas and rupee signs are fine; blank is no price; words are refused', () => {
  assert.equal(parsePrice('15,750'), 15750);
  assert.equal(parsePrice('₹ 15750.00'), 15750);
  assert.equal(parsePrice('  '), null);
  assert.ok(Number.isNaN(parsePrice('call')));
  assert.ok(Number.isNaN(parsePrice('0')), 'a zero price is a typo, not free stones');
});

test('price import: a cell sets, a blank removes, what the file leaves out is kept', () => {
  const header = ['stone_type', 'size_id', 'shape', 'mm', 'carats', 'EF VVS-VS', 'ef vs-si'];
  const plan = planPrices(header, [
    ['LGD', 'rbc-1.3', 'Round', '⌀ 1.3 mm', '0.01 ct', '15,750', ''],
  ], ctx([
    [k('Lab Grown', 'RBC-1.3', 'EF', 'VVS-VS'), 15000],
    [k('Lab Grown', 'RBC-1.3', 'EF', 'VS-SI'), 14500],
    [k('Natural', 'RBC-1.3', 'EF', 'VVS-VS'), 31000],   // other stone type: not in file, kept
    [k('Lab Grown', 'RBC-6.4', 'EF', 'VVS-VS'), 9000],  // other size: not in file, kept
  ]));
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.set.map((s) => [s.size_id, s.clarity, s.before, s.price_per_ct]), [['RBC-1.3', 'VVS-VS', 15000, 15750]]);
  assert.deepEqual(plan.remove.map((r) => [r.size_id, r.clarity]), [['RBC-1.3', 'VS-SI']]);
  assert.equal(plan.unchanged, 0);
});

test('price import: bad headers and rows are named, nothing half-applies', () => {
  const unknown = planPrices(['stone_type', 'size_id', 'EF VVS'], [['LGD', 'RBC-1.3', '1']], ctx());
  assert.match(unknown.errors[0], /"EF VVS" is not a quality option/);
  const retired = planPrices(['stone_type', 'size_id', 'GH SI'], [['LGD', 'RBC-1.3', '1']], ctx());
  assert.match(retired.errors[0], /retired/);
  const rows = planPrices(['stone_type', 'size_id', 'EF VVS-VS'], [
    ['Moissanite', 'RBC-1.3', '1'], ['LGD', 'RBC-9', '1'], ['LGD', 'RBC-1.3', 'call'], ['LGD', 'RBC-6.4', '1'], ['Lab Grown', 'RBC-6.4', '2'],
  ], ctx());
  assert.equal(rows.errors.length, 4);
  assert.match(rows.errors[0], /Row 2: "Moissanite" is not a stone type/);
  assert.match(rows.errors[1], /Row 3: no size RBC-9/);
  assert.match(rows.errors[2], /Row 4, EF VVS-VS: "call" is not a price/);
  assert.match(rows.errors[3], /Row 6: Lab Grown RBC-6.4 is already on row 5/);
});
