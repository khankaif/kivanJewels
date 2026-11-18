import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseId, caratsLabel, newId, nominalCarats, parseCarats, planSizes, readSize } from '../features/masters/sizes/chart';
import { parseCsv } from '../lib/csv';
import { readParty } from '../features/parties/party-row';

const shapes = [{ shape: 'Round', code: 'RBC' }, { shape: 'Square Cushion', code: 'CMB' }, { shape: 'Tapered Baguette', code: 'TBAG' }];
const row = (r: Record<string, string>) => readSize((c) => r[c], shapes);

test('Size IDs: shape code + mm; a second weight at the same mm gets its carats', () => {
  const round = { length_mm: 1.3, width_mm: 1.3, width2_mm: null };
  assert.equal(baseId('RBC', round), 'RBC-1.3', 'a round shows one figure');
  assert.equal(baseId('PS', { length_mm: 4, width_mm: 2.5, width2_mm: null }), 'PS-4X2.5');
  assert.equal(baseId('TBAG', { length_mm: 6.3, width_mm: 3.15, width2_mm: 1.89 }), 'TBAG-6.3X3.15X1.89');
  const cushion = { shape: 'Square Cushion', length_mm: 5.3, width_mm: 5.3, width2_mm: null, min_ct: 0.8, max_ct: 0.8, active: true };
  assert.equal(newId('CMB', cushion, new Set(['CMB-5.3'])), 'CMB-5.3-0.8');
});

  test('carats: single weight input (e.g. 0.014 or 0.0145), taking minimum if legacy range is passed', () => {
    assert.deepEqual(parseCarats('0.1'), { min_ct: 0.1, max_ct: 0.1 });
    assert.deepEqual(parseCarats('0.014'), { min_ct: 0.014, max_ct: 0.014 });
    assert.deepEqual(parseCarats('0.0145'), { min_ct: 0.0145, max_ct: 0.0145 });
    assert.deepEqual(parseCarats('0.014-0.015'), { min_ct: 0.014, max_ct: 0.014 }, 'legacy range takes the minimum');
    assert.deepEqual(parseCarats('0.01454'), { min_ct: 0.0145, max_ct: 0.0145 }, 'rounds to 4 decimals');
    assert.equal(parseCarats('+2'), null, 'a sieve is not a weight');
    assert.equal(parseCarats('0'), null, 'zero is rejected');
    assert.equal(parseCarats('-0.5'), null, 'negative is rejected');
    assert.equal(parseCarats('150'), null, 'above 100 ct is rejected');
    assert.equal(nominalCarats({ min_ct: 0.014, max_ct: 0.014 }), 0.014);
    assert.equal(caratsLabel({ min_ct: 0.014, max_ct: 0.014 }), '0.014 ct');
    assert.equal(caratsLabel({ min_ct: 0.0145, max_ct: 0.0145 }), '0.0145 ct');
  });

  test('size row: shape by name or code, mm required, bad values named', () => {
    const ok = row({ shape: 'rbc', length_mm: '1.30', width_mm: '1.3', carats: '0.01' });
    assert.ok('size' in ok);
    assert.equal(ok.size.shape, 'Round');
    assert.equal(ok.size.active, true, 'blank active = yes');
    assert.match((row({ shape: 'Kite', length_mm: '1', width_mm: '1', carats: '1' }) as { error: string }).error, /not a shape/);
    assert.match((row({ shape: 'Round', width_mm: '1', carats: '1' }) as { error: string }).error, /Length/);
    assert.match((row({ shape: 'Round', length_mm: '1', width_mm: '1', carats: '+2' }) as { error: string }).error, /Carats/);
    assert.match((row({ shape: 'Round', length_mm: '1000', width_mm: '1', carats: '1' }) as { error: string }).error, /between 0.01 and 999.99/);
    assert.match((row({ shape: 'Round', length_mm: '1', width_mm: '1', width2_mm: '0.5', carats: '1' }) as { error: string }).error, /narrow width/);
    assert.match((row({ shape: 'TBAG', length_mm: '6', width_mm: '3', carats: '0.5' }) as { error: string }).error, /requires a narrow width/);
    assert.match((row({ shape: 'TBAG', length_mm: '6', width_mm: '3', width2_mm: '4', carats: '0.5' }) as { error: string }).error, /must be smaller than width/);
  });

  test('import plan: adds, edits by id, matches an identical row, keeps what the file leaves out', () => {
    const saved = [
      { id: 'RBC-1.3', shape: 'Round', length_mm: 1.3, width_mm: 1.3, width2_mm: null, min_ct: 0.01, max_ct: 0.01, active: true, used: 4 },
      { id: 'RBC-6.4', shape: 'Round', length_mm: 6.4, width_mm: 6.4, width2_mm: null, min_ct: 1, max_ct: 1, active: true, used: 0 },
    ];
    const plan = planSizes([
      { line: 2, read: row({ shape: 'Round', length_mm: '1.3', width_mm: '1.3', carats: '0.01' }) },          // same as saved, no id
      { line: 3, read: row({ size_id: 'RBC-6.4', shape: 'Round', length_mm: '6.4', width_mm: '6.4', carats: '1.02' }) }, // edit
      { line: 4, read: row({ shape: 'Square Cushion', length_mm: '5.3', width_mm: '5.3', carats: '0.75' }) },
      { line: 5, read: row({ shape: 'Square Cushion', length_mm: '5.3', width_mm: '5.3', carats: '0.8' }) },
    ], saved, shapes);
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.unchanged, 1);
    assert.deepEqual(plan.update.map((u) => [u.id, u.after.min_ct]), [['RBC-6.4', 1.02]]);
    assert.deepEqual(plan.add.map((a) => a.id), ['CMB-5.3', 'CMB-5.3-0.8']);

    const bad = planSizes([
      { line: 2, read: row({ size_id: 'RBC-9', shape: 'Round', length_mm: '9', width_mm: '9', carats: '3' }) },
      { line: 3, read: row({ size_id: 'RBC-1.3', shape: 'Square Cushion', length_mm: '1.3', width_mm: '1.3', carats: '0.01' }) },
      { line: 4, read: row({ shape: 'Round', length_mm: '2', width_mm: '2', carats: '0.03' }) },
      { line: 5, read: row({ shape: 'Round', length_mm: '2', width_mm: '2', carats: '0.03' }) },
    ], saved, shapes);
    assert.equal(bad.errors.length, 3);
    assert.match(bad.errors[0], /Row 2: no saved size RBC-9/);
    assert.match(bad.errors[1], /Row 3: .*can't change shape/);
    assert.match(bad.errors[2], /Row 5: same size as row 4/);
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
