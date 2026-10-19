import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../lib/dates';

test('addDays counts whole calendar days', () => {
  assert.equal(addDays('2026-09-11', 7), '2026-09-18');
  assert.equal(addDays('2026-02-25', 4), '2026-03-01');
  assert.equal(addDays('2026-09-11', 0), '2026-09-11');
  assert.equal(addDays('', 7), '');
});
