import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShorthand, tokenize } from '@/features/spec/shorthand';
import { testSize } from './helpers';

test('tokenize separates carats and rate from the words', () => {
  const t = tokenize('RD-100 DEF VVS 2.35 @4,200');
  assert.equal(t.carats, 2.35);
  assert.equal(t.rate, 4200);
  assert.deepEqual(t.words, ['RD-100', 'DEF', 'VVS']);
});

test('a saved Size ID becomes the size; grades resolve; unknown words come back', async () => {
  const { sizeId } = await testSize();
  const r = await parseShorthand(`${sizeId.toLowerCase()} lgd ef VVS1 2.35 @4200 zzqx`);
  assert.equal(r.spec.sizeId, sizeId);
  assert.equal(r.spec.stoneType, 'Lab Grown');
  assert.equal(r.spec.colour, 'EF');
  assert.equal(r.spec.clarity, 'VVS1');
  assert.equal(r.carats, 2.35);
  assert.equal(r.rate, 4200);
  assert.deepEqual(r.unknown, ['zzqx']);
});
