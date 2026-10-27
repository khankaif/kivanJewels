import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShorthand, tokenize } from '@/features/masters/diamonds/shorthand';

test('tokenize separates sieve, mm, carats and rate from the words', () => {
  const t = tokenize('9-9.5 RD DEF VVS 2.35 @4,200');
  assert.equal(t.sieve, '9-9.5');
  assert.equal(t.carats, 2.35);
  assert.equal(t.rate, 4200);
  assert.deepEqual(t.words, ['RD', 'DEF', 'VVS']);
  assert.equal(tokenize('5x2.5mm oval 0.73ct').mm, '5x2.5');
  assert.equal(tokenize('+11 round 1.2').sieve, '+11');
});

test('words resolve through the master; unknown words come back, not dropped', async () => {
  const r = await parseShorthand('9-9.5 round VVS1 2.35 @4200 zzqx');
  assert.equal(r.spec.sieveSize, '9-9.5');
  assert.equal(r.spec.shape, 'Round');
  assert.equal(r.spec.clarity, 'VVS1');
  assert.equal(r.carats, 2.35);
  assert.equal(r.rate, 4200);
  assert.deepEqual(r.unknown, ['zzqx']);
});
