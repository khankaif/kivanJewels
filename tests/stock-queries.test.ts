import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnedUnits, getMemoStock, getStockTotals } from '@/features/stock/queries';
import { getMovements } from '@/features/stock/register';
import { getCashFlow, getDashboard, getForecast, getInbox } from '@/features/dashboard/queries';
import { getPartyBalances, getAging, getAccountTotals, getPnl } from '@/features/accounts/queries';
import { getBills } from '@/features/accounts/money';
import { getParties, getPartyOptions } from '@/features/parties/queries';
import { getPipeline, getAdhocApprovals } from '@/features/sales/queries';
import { getMemos, getAgents } from '@/features/memos/queries';
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
    getDashboard(), getForecast(), getInbox(null), getInbox('collect'), getCashFlow('w'),
    getPartyBalances(), getAging(new Date().toISOString().slice(0, 10)), getAccountTotals(), getPnl(),
    getBills({ limit: 5 }), getParties(), getPartyOptions('client'),
    getPipeline(), getAdhocApprovals(),
    getMemos('out'), getAgents(),
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

test('the inbox puts what is due soon above what is already late', async () => {
  const { items } = await getInbox(null, 50);
  const firstLate = items.findIndex((t) => t.daysLate > 0);
  if (firstLate > 0) assert.ok(items.slice(firstLate).every((t) => t.daysLate > 0), 'a due-soon row sits below a late one');
  assert.equal(new Set(items.map((t) => t.key)).size, items.length, 'duplicate inbox rows');
});
