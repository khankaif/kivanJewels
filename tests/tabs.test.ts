import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTab } from '../lib/tabs';

const TABS = ['owned', 'memo', 'movements'] as const;

test('a known tab is kept', () => {
  assert.equal(resolveTab('memo', TABS), 'memo');
});

test('an unknown or missing tab falls back to the first', () => {
  assert.equal(resolveTab('nonsense', TABS), 'owned');
  assert.equal(resolveTab(undefined, TABS), 'owned');
  assert.equal(resolveTab('', TABS), 'owned');
});
