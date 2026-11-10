import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandProblem, estimateMm, sizeId, standardBands } from '../features/masters/sizes/chart';
import { parseCsv } from '../lib/csv';
import { readParty } from '../features/parties/party-row';

test('estimated mm scale with the cube root of carats (Medusa workbook values)', () => {
  assert.deepEqual(estimateMm(1, { length_mm: 6.4, width_mm: 6.4 }), { est_length_mm: 6.4, est_width_mm: 6.4 });
  // 0.5 ct round: 6.4 x 0.5^(1/3) = 5.0797 -> 5.08
  assert.deepEqual(estimateMm(0.5, { length_mm: 6.4, width_mm: 6.4 }), { est_length_mm: 5.08, est_width_mm: 5.08 });
  // Ratio is preserved: a pear stays 8.5 / 5.5 at any size.
  const p = estimateMm(2, { length_mm: 8.5, width_mm: 5.5 });
  assert.equal(Math.round((p.est_length_mm / p.est_width_mm) * 100) / 100, 1.55);
});

test('standard grid: 40 contiguous bands, 0.05 to 2.00 ct, top band closed', () => {
  const b = standardBands();
  assert.equal(b.length, 40);
  assert.deepEqual(b[0], { min_ct: 0.05, max_ct: 0.075, nominal_ct: 0.05 });
  assert.deepEqual(b[19], { min_ct: 0.975, max_ct: 1.025, nominal_ct: 1 });
  assert.deepEqual(b[39], { min_ct: 1.975, max_ct: 2, nominal_ct: 2 });
  for (let i = 1; i < b.length; i++) assert.equal(b[i].min_ct, b[i - 1].max_ct, 'no gap, no overlap');
  assert.equal(sizeId('RD', 1), 'RD-100');
  assert.equal(sizeId('PR', 0.05), 'PR-005');
  assert.equal(sizeId('RD', 0.003), null, 'melee would collide with RD-000; it is typed instead');
});

test('band validation', () => {
  assert.equal(bandProblem({ min_ct: 0.975, max_ct: 1.025, nominal_ct: 1 }), null);
  assert.match(bandProblem({ min_ct: 1, max_ct: 1, nominal_ct: 1 })!, /below/);
  assert.equal(bandProblem({ min_ct: 0.001, max_ct: 0.002, nominal_ct: 0.0015 }), null, 'melee bands fit');
  assert.match(bandProblem({ min_ct: 0.0005, max_ct: 0.1, nominal_ct: 0.05 })!, /0\.001 to 3/);
  assert.match(bandProblem({ min_ct: 1, max_ct: 1.2, nominal_ct: 1.5 })!, /within/);
});

test('CSV: Excel BOM, quoted commas and CRLF', () => {
  assert.deepEqual(
    parseCsv('﻿name,address\r\n"Naice, LLP","Opera ""House"""\r\n\r\n'),
    [['name', 'address'], ['Naice, LLP', 'Opera "House"']],
  );
});

test('party row: same rules as the form, with the table defaults for blanks', () => {
  const row = (r: Record<string, string>) => readParty((c) => r[c]);
  const ok = row({ name: ' naice gems llp ', kind: 'Client', gstin: '27aaafn1234a1z5' });
  assert.ok('party' in ok);
  assert.equal(ok.party.name, 'Naice Gems LLP');
  assert.equal(ok.party.kind, 'client');
  assert.equal(ok.party.default_terms_days, 7);
  assert.equal(ok.party.gstin, '27AAAFN1234A1Z5');
  assert.ok('error' in row({ name: '' }));
  assert.ok('error' in row({ name: 'X', kind: 'vendor' }));
  assert.ok('error' in row({ name: 'X', default_terms_days: '7.5' }));
});
