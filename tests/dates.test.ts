import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, parseLooseDate } from '../lib/dates';

test('passes ISO through', () => {
  assert.equal(parseLooseDate('2024-06-28'), '2024-06-28');
});

test('parses DD-Mon-YY with the non-standard Sept token', () => {
  assert.equal(parseLooseDate('29-Sept-25'), '2025-09-29');
  assert.equal(parseLooseDate('24-sept-24'), '2024-09-24');
  assert.equal(parseLooseDate('25-Sept-2024'), '2024-09-25');
});

test('parses the Jn typo as June', () => {
  assert.equal(parseLooseDate('29-Jn-2025'), '2025-06-29');
});

test('parses DD/MM/YYYY and DD-MM-YYYY as day-first', () => {
  assert.equal(parseLooseDate('25/09/2024'), '2024-09-25');
  assert.equal(parseLooseDate('31-08-2024'), '2024-08-31');
});

test('returns null for sentinels and junk', () => {
  for (const v of ['Pending', '-', '', ' ', null, undefined, 'LOC-26-27-00164']) {
    assert.equal(parseLooseDate(v), null, `expected null for ${JSON.stringify(v)}`);
  }
});

test('rejects impossible dates rather than rolling them over', () => {
  assert.equal(parseLooseDate('31-Feb-24'), null);
});

test('every date value in the real workbook parses or is a known sentinel', async () => {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync('ref/initial_data.json', 'utf8'));
  const cols = ['Pur. Date', 'Order Date', 'Due Date', 'Payment Date',
    'Diamond Delivery Date', 'Payment Date_1', 'Date', 'Purchase Date', 'Amt Rec Date'];
  const unparsed = new Map<string, number>();
  for (const r of [...data.diamond_hisab, ...data.jewellery_master]) {
    for (const c of cols) {
      if (!(c in r)) continue;
      const v = r[c];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      const s = String(v).trim();
      if (parseLooseDate(v) === null && s !== 'Pending' && s !== '-') {
        unparsed.set(s, (unparsed.get(s) ?? 0) + 1);
      }
    }
  }
  // The single known bad cell: a Due Date holding a bill number.
  assert.deepEqual([...unparsed.keys()], ['LOC-26-27-00164'],
    `unexpected unparsed date values: ${JSON.stringify([...unparsed])}`);
});

test('addDays counts whole calendar days', () => {
  assert.equal(addDays('2026-09-11', 7), '2026-09-18');
  assert.equal(addDays('2026-02-25', 4), '2026-03-01');
  assert.equal(addDays('2026-09-11', 0), '2026-09-11');
  assert.equal(addDays('', 7), '');
});
