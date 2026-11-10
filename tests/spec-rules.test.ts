import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSpec, gradeValue, hides, validateSpec } from '@/lib/spec-rules';

test('grades resolve case-insensitively and by alias; anything else is refused', () => {
  assert.equal(gradeValue('colour', 'ef'), 'EF');
  assert.equal(gradeValue('clarity', 'vvs-vs'), 'VVS-VS');
  assert.equal(gradeValue('stoneType', 'LGD'), 'Lab Grown');
  assert.equal(gradeValue('certified', 'yes'), 'Certified');
  assert.equal(gradeValue('clarity', 'VVV-VS'), null, "the old book's typo is not a grade");
  assert.equal(gradeValue('colour', '  '), '', 'blank stays blank');
});

test('a stone needs a type, a size and a certification answer', () => {
  assert.match(validateSpec({ sizeId: 'RD-100', certified: 'Non-certified' })!, /stone type/);
  assert.match(validateSpec({ stoneType: 'Natural', certified: 'Non-certified' })!, /size/);
  assert.match(validateSpec({ stoneType: 'Natural', sizeId: 'RD-100' })!, /certification/);
  assert.equal(validateSpec({ stoneType: 'Natural', sizeId: 'RD-100', certified: 'Non-certified' }), null);
});

test('a lab only exists on a certified stone', () => {
  const base = { stoneType: 'Natural', sizeId: 'RD-100' };
  assert.match(validateSpec({ ...base, certified: 'Certified' })!, /lab/);
  assert.equal(hides({ certified: 'Non-certified' }, 'lab'), true);
  assert.equal(cleanSpec({ ...base, certified: 'Non-certified', lab: 'IGI' }).lab, null,
    'a stale lab never reaches the unit key');
});
