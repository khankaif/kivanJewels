import test from 'node:test';
import assert from 'node:assert/strict';
import { CERTIFIED, cleanSpec, gradeValue, hides, validateSpec, type Grades } from '@/lib/spec-rules';

// A slice of the grade master, as getGrades() returns it.
const grades: Grades = {
  stoneType: [{ name: 'Lab Grown', code: 'LGD' }, { name: 'Natural', code: 'ND' }],
  colour: [{ name: 'EF', code: 'EF' }, { name: 'Fancy Light Yellow', code: 'FLY' }],
  clarity: [{ name: 'VVS-VS', code: 'VVS-VS' }],
  lab: [{ name: 'IGI', code: 'IGI' }],
  certified: CERTIFIED,
};

test('grades resolve on name or code, ignoring case; anything else is refused', () => {
  assert.equal(gradeValue(grades, 'colour', 'ef'), 'EF');
  assert.equal(gradeValue(grades, 'colour', 'fly'), 'Fancy Light Yellow', 'the code finds the name');
  assert.equal(gradeValue(grades, 'clarity', 'vvs-vs'), 'VVS-VS');
  assert.equal(gradeValue(grades, 'stoneType', 'LGD'), 'Lab Grown');
  assert.equal(gradeValue(grades, 'certified', 'yes'), 'Certified');
  assert.equal(gradeValue(grades, 'clarity', 'VVV-VS'), null, "the old book's typo is not a grade");
  assert.equal(gradeValue(grades, 'colour', '  '), '', 'blank stays blank');
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
