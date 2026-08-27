import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkReconciliation } from '../lib/reconcile';

test('imported database reconciles to the source workbook', async () => {
  const checks = await checkReconciliation();
  const failed = checks.filter((c) => !c.ok);
  assert.deepEqual(
    failed.map((c) => `${c.label}: got ${c.got}, want ${c.want} (tol ${c.tol})`),
    [],
  );
  assert.ok(checks.length >= 11, 'expected the full check set to run');
});
