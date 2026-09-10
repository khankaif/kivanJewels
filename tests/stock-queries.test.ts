import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnedUnits, getMemoStock, getStockTotals } from '@/features/stock/queries';
import { getMovements } from '@/features/stock/register';
import { getDashboard, getWorklist } from '@/features/dashboard/queries';
import { getPartyBalances, getAging, getAccountTotals, getPnl } from '@/features/accounts/queries';
import { getBills } from '@/features/accounts/money';
import { getParties, getPartyOptions } from '@/features/parties/queries';
import { getPipeline, getAdhocApprovals, getRequirements } from '@/features/sales/queries';
import { getMemos, getMemoSummary, getAgents } from '@/features/memos/queries';
import {
  getAttributeBuckets, getDiamondPicklists, getMasterMismatches, getSieveShapes,
} from '@/features/masters/diamonds/queries';
import { search } from '@/features/search/queries';

/**
 * Every page's data path, run once.
 *
 * These read views, not tables, so a column added to `lots` is invisible to
 * them until the view is replaced too -- which is exactly how certification
 * broke the bills page after 023: `getOwnedUnits` asked `lot_balances` for a
 * column only `lots` had. Type checking cannot see inside a SQL string, so
 * running each query is the check.
 */
test('every page query runs against the live schema', async () => {
  const results = await Promise.all([
    getOwnedUnits({ limit: 5 }), getMemoStock(), getStockTotals(), getMovements({ limit: 5 }),
    getDashboard(), getWorklist(),
    getPartyBalances(), getAging(new Date().toISOString().slice(0, 10)), getAccountTotals(), getPnl(),
    getBills({ limit: 5 }), getParties(), getPartyOptions('client'),
    getPipeline(), getAdhocApprovals(), getRequirements({ status: 'all' }),
    getMemos('out'), getMemoSummary(), getAgents(),
    getAttributeBuckets(), getDiamondPicklists(), getSieveShapes(), getMasterMismatches(),
    search('a'),
  ]);
  assert.equal(results.filter((r: unknown) => r === undefined).length, 0);
});

test('owned units carry the certification fields the master now demands', async () => {
  for (const u of await getOwnedUnits({ limit: 5 })) {
    assert.ok('lab' in u && 'certified' in u);
  }
});
