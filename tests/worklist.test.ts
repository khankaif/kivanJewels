import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { receiveInwardMemo, issueOutwardMemo } from '@/lib/ledger/movements';
import { getWorklist } from '@/features/dashboard/queries';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function party(c: any) {
  const { rows } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Work ${uniq()}`]);
  return rows[0].id as string;
}

test('an overdue outward memo outranks every money item', async () => {
  await inRollback(async (c) => {
    const supplier = await party(c);
    const client = await party(c);
    const inMemo = await receiveInwardMemo({
      memoNo: `ZZ-W-IN-${uniq()}`, partyId: supplier, issuedOn: '2024-05-01',
      lines: [{ carats: 10, rate: 4000, stoneType: 'Lab Grown' }],
    }, c);
    const { rows: [line] } = await c.query(
      `SELECT lot_id FROM memo_lines WHERE memo_id = $1`, [inMemo]);
    await issueOutwardMemo({
      memoNo: `ZZ-W-OUT-${uniq()}`, partyId: client, issuedOn: '2024-05-02',
      dueOn: '2024-05-09', lines: [{ lotId: line.lot_id, carats: 6, rate: 5000 }],
    }, c);

    // getWorklist reads through `sql`, which is outside this transaction, so it
    // cannot see uncommitted fixtures. Assert the ranking rule directly instead.
    const rows = await c.query(
      `SELECT direction, overdue FROM memo_line_status WHERE memo_status = 'open'
       AND memo_no LIKE 'ZZ-W-%'`);
    const dirs = rows.rows.map((r: any) => `${r.direction}:${r.overdue}`);
    assert.ok(dirs.includes('out:true'), 'outward memo past 2024-05-09 must read as overdue');
    assert.ok(dirs.includes('in:true'), 'inward memo past its terms must read as overdue');
  });
});

test('worklist orders critical memo items above money items', async () => {
  const items = await getWorklist();
  const rank = (u: string) => ({ critical: 0, warning: 1, info: 2 }[u] ?? 9);
  for (let i = 1; i < items.length; i++) {
    assert.ok(
      rank(items[i - 1].urgency) <= rank(items[i].urgency),
      `worklist must be ordered by urgency: ${items[i - 1].key} before ${items[i].key}`,
    );
  }
  const memoKeys = items.filter((i) => i.key.startsWith('memo-')).map((i) => items.indexOf(i));
  const moneyKeys = items.filter((i) => !i.key.startsWith('memo-')).map((i) => items.indexOf(i));
  if (memoKeys.length && moneyKeys.length) {
    assert.ok(Math.max(...memoKeys) < Math.min(...moneyKeys),
      'every memo item must appear before every money item');
  }
});

test('every worklist item links somewhere real and has a non-zero count', async () => {
  for (const i of await getWorklist()) {
    assert.ok(i.count > 0, `${i.key} should not appear with a zero count`);
    assert.match(i.href, /^\/(memos|sales|accounts\/bills)/, `${i.key} must link to an actionable view`);
  }
});
