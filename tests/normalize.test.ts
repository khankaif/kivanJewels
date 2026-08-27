import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPartyName, partyKey, resolveParties } from '../lib/normalize';

test('collapses the seven real collision groups to one name each', () => {
  const groups = [
    ['A B Creation', 'A.B.Creation'],
    ['Babeshwar', 'BABESHWAR'],
    ['H.R.IMPEX', 'H R Impex'],
    ['ETHEREAL GREEN', 'Ethereal Green'],
    ['KIA GEMS', 'KIA Gems'],
    ['Ecobrilliance', 'Eco Brilliance'],
    ['KIRA DIAM', 'Kira Diam'],
  ];
  for (const g of groups) {
    const resolved = resolveParties(g);
    assert.equal(resolved.size, 1, `${g.join(' / ')} did not collapse: ${[...resolved.values()]}`);
  }
});

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

test('collapses the real workbook party set from 116 to 109', async () => {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync('ref/initial_data.json', 'utf8'));
  const raws: string[] = [];
  for (const r of data.diamond_hisab) {
    for (const c of ['Pur. Party', 'Party Name']) {
      const v = String(r[c] ?? '').trim();
      if (v && v !== 'None' && v !== '-') raws.push(v);
    }
  }
  const distinct = new Set(raws);
  const resolved = resolveParties(raws);
  assert.equal(distinct.size, 116, 'raw distinct party spellings');
  assert.equal(resolved.size, 109, 'after collapse');

  const collapsed = [...new Set(raws)].reduce((acc, s) => {
    const k = partyKey(s);
    (acc[k] ??= []).push(s);
    return acc;
  }, {} as Record<string, string[]>);
  const groups = Object.values(collapsed).filter((g) => g.length > 1);
  assert.equal(groups.length, 7, `expected 7 collision groups, got ${JSON.stringify(groups)}`);
});
