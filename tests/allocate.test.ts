import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { allocate } from '@/features/sales/allocate';

test('takes lots in the order given until the want is filled', () => {
  const { picks, short } = allocate(
    [{ lotId: 'owned', balance: 6 }, { lotId: 'memo', balance: 10 }], 8);
  assert.deepEqual(picks, [{ lotId: 'owned', carats: 6 }, { lotId: 'memo', carats: 2 }]);
  assert.equal(short, 0);
});

test('reports what it could not fill instead of overdrawing', () => {
  const { picks, short } = allocate([{ lotId: 'a', balance: 2.5 }], 4);
  assert.deepEqual(picks, [{ lotId: 'a', carats: 2.5 }]);
  assert.equal(Number(short.toFixed(3)), 1.5);
});

test('never asks a lot for more than the third decimal it holds', () => {
  const { picks, short } = allocate([{ lotId: 'a', balance: 1.0004 }], 1.0004);
  assert.deepEqual(picks, [{ lotId: 'a', carats: 1 }]);
  assert.equal(short, 0, 'a sub-milligram remainder is not a shortfall');
});

test('an empty shelf fills nothing', () => {
  assert.deepEqual(allocate([], 3), { picks: [], short: 3 });
});
