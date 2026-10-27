import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPartyName, slugify } from '../lib/normalize';

test('trims trailing spaces seen in the source', () => {
  assert.equal(canonicalPartyName('Kaivan '), canonicalPartyName('Kaivan'));
});

test('returns null for blanks and placeholders', () => {
  for (const v of [null, undefined, '', '  ', '-', 'None']) {
    assert.equal(canonicalPartyName(v), null);
  }
});

test('does not merge genuinely different parties', () => {
  assert.notEqual(canonicalPartyName('Naice Gems LLP'), canonicalPartyName('Naice Jewels'));
});

test('slugify strips accents and punctuation into a URL-safe slug', () => {
  assert.equal(slugify('ÉCLORA — The Circle of Eternal Light'), 'eclora-the-circle-of-eternal-light');
  assert.equal(slugify('  18K / Rose-Gold  '), '18k-rose-gold');
  assert.equal(slugify('— —'), '');
});
