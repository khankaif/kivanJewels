/**
 * Which fields name a stone, and the values each may hold.
 *
 * A parcel is its type, its size from the chart (Masters -> Diamonds; the size
 * fixes the shape), its grades and its certification. Grades are fixed lists
 * here rather than an editable master: they are industry vocabulary that
 * changes once in years, and a list anyone can edit is how the old book grew
 * 'VVV-VS' beside 'VVS-VS'. A new grade is a one-line change to this file.
 */

export const SPEC_FIELDS = ['stoneType', 'sizeId', 'colour', 'clarity', 'certified', 'lab'] as const;
export type SpecField = (typeof SPEC_FIELDS)[number];

/** A spec as forms and JSON carry it. `shape` is never typed: the size decides it. */
export type Spec = Partial<Record<SpecField | 'shape', string | null>>;

/** The fixed value lists, in the order pickers show them. */
export const GRADES = {
  stoneType: ['Lab Grown', 'Natural', 'Gemstone'],
  colour: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'DE', 'EF', 'FG', 'GH', 'HI'],
  clarity: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1',
            'VVS', 'VVS-VS', 'VS', 'VS-SI', 'SI'],
  certified: ['Certified', 'Non-certified'],
  lab: ['IGI', 'GIA', 'HRD', 'SGL'],
} as const satisfies Partial<Record<SpecField, readonly string[]>>;
export type GradeField = keyof typeof GRADES;

/** Storefront categories for the jewellery catalog. */
export const JEWELLERY_CATEGORIES = ['Gold Vermeil Jewelry'] as const;

/** What people type for a grade, mapped to its value. Used by shorthand and imports. */
const ALIASES: Partial<Record<GradeField, Record<string, string>>> = {
  stoneType: { lgd: 'Lab Grown', 'lab grown diamond': 'Lab Grown', lab: 'Lab Grown', 'natural diamond': 'Natural' },
  certified: { cert: 'Certified', yes: 'Certified', 'non cert': 'Non-certified', 'non-cert': 'Non-certified', no: 'Non-certified' },
};

export const FIELD_LABELS: Record<SpecField, string> = {
  stoneType: 'stone type', sizeId: 'size', colour: 'colour',
  clarity: 'clarity', certified: 'certification', lab: 'lab',
};

/** Always asked for. The lab is asked once the stone is certified. */
export const REQUIRED: SpecField[] = ['stoneType', 'sizeId', 'certified'];

/** True when this value of `certified` means the stone carries a certificate. */
export const isCertified = (v: string | null | undefined) =>
  ['certified', 'cert', 'yes', 'y', 'true'].includes(String(v ?? '').trim().toLowerCase());

/**
 * A grade as typed -> its list value, case-insensitively or by alias; null when
 * it is not a value of that list. Blank in, blank out (as '').
 */
export function gradeValue(field: GradeField, raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return '';
  return (GRADES[field] as readonly string[]).find((v) => v.toLowerCase() === t) ?? ALIASES[field]?.[t] ?? null;
}

/** Fields this stone does not have: a lab on an uncertified stone. */
export const hides = (spec: Spec, field: SpecField) => field === 'lab' && !isCertified(spec.certified);

/** Drops values for fields the stone does not have, so they never reach the key. */
export function cleanSpec<T extends Spec>(spec: T): T {
  const out = { ...spec };
  for (const f of SPEC_FIELDS) if (hides(spec, f)) out[f] = null as T[SpecField];
  return out;
}

/** Returns the first problem with a spec, or null. Call it on a cleaned spec. */
export function validateSpec(spec: Spec): string | null {
  for (const f of REQUIRED) {
    if (!String(spec[f] ?? '').trim()) return `Enter the ${FIELD_LABELS[f]}.`;
  }
  if (isCertified(spec.certified) && !String(spec.lab ?? '').trim()) {
    return 'Enter the lab that certified it.';
  }
  return null;
}
