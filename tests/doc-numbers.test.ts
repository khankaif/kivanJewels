import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { nextDocNo, docNoOr } from '@/lib/doc-numbers';

test('a series issues consecutive, padded, year-stamped numbers', async () => {
  await inRollback(async (c) => {
    const year = new Date().getFullYear();
    const first = await nextDocNo('memo_out', c);
    const second = await nextDocNo('memo_out', c);

    assert.match(first, new RegExp(`^KJ-OUT-${year}-\\d{4}$`));
    assert.equal(Number(second.slice(-4)), Number(first.slice(-4)) + 1);
  });
});

test('each series counts on its own', async () => {
  await inRollback(async (c) => {
    const memo = await nextDocNo('memo_in', c);
    const invoice = await nextDocNo('invoice', c);
    assert.ok(memo.startsWith('KJ-IN-'));
    assert.ok(invoice.startsWith('KJ-INV-'));
  });
});

test('a typed number is kept; a blank one is issued', async () => {
  await inRollback(async (c) => {
    assert.equal(await docNoOr('  SUPP/2026/44 ', 'memo_in', c), 'SUPP/2026/44');
    assert.match(await docNoOr('', 'memo_in', c), /^KJ-IN-/);
  });
});

test('a rolled-back save gives its number back', async () => {
  let taken = '';
  await inRollback(async (c) => { taken = await nextDocNo('invoice', c); });
  await inRollback(async (c) => {
    assert.equal(await nextDocNo('invoice', c), taken, 'the series did not skip a number');
  });
});
