import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cleanSpec, hides, usesSieve, validateSpec } from '@/lib/spec-rules';

const sieved = ['Round', 'Round-Single Cut'];
const base = {
  stoneType: 'Lab Grown', colour: 'EF', clarity: 'VVS-VS', shape: 'Round',
  sieveSize: '8.5-9', mmSize: '', certified: 'Non-certified', lab: '',
};

test('only the shapes flagged in the master are sieved', () => {
  assert.equal(usesSieve(sieved, 'Round'), true);
  assert.equal(usesSieve(sieved, 'round'), true, 'the flag is not case-sensitive');
  assert.equal(usesSieve(sieved, 'Oval'), false);
  assert.equal(usesSieve(sieved, null), false);
});

test('a sieve on a shape measured in mm is dropped, not stored', () => {
  const oval = cleanSpec({ ...base, shape: 'Oval', sieveSize: '8.5-9', mmSize: '4.00' }, sieved);
  assert.equal(oval.sieveSize, null);
  assert.equal(oval.mmSize, '4.00');
  assert.equal(hides(sieved, oval, 'sieveSize'), true);
});

test('the size a shape actually uses is the one demanded', () => {
  assert.equal(validateSpec(base, sieved), null);
  assert.match(String(validateSpec({ ...base, sieveSize: '' }, sieved)), /sieve size/);
  assert.match(
    String(validateSpec({ ...base, shape: 'Oval', sieveSize: '', mmSize: '' }, sieved)),
    /MM size — Oval/,
  );
  assert.equal(validateSpec({ ...base, shape: 'Oval', sieveSize: '', mmSize: '4.00' }, sieved), null);
});

test('type, shape and a certification answer are always required', () => {
  assert.match(String(validateSpec({ ...base, stoneType: '' }, sieved)), /stone type/);
  assert.match(String(validateSpec({ ...base, shape: '' }, sieved)), /shape/);
  assert.match(String(validateSpec({ ...base, certified: '' }, sieved)), /certification/);
});

test('the lab belongs to the certificate, not to the stone', () => {
  const plain = cleanSpec({ ...base, certified: 'Non-certified', lab: 'IGI' }, sieved);
  assert.equal(plain.lab, null);
  assert.equal(validateSpec(plain, sieved), null);

  assert.match(String(validateSpec({ ...base, certified: 'Certified' }, sieved)), /lab/);
  assert.equal(validateSpec({ ...base, certified: 'Certified', lab: 'IGI' }, sieved), null);
});
