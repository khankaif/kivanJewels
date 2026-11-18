/**
 * Which fields name a stone, and how a typed value becomes a master value.
 *
 * A parcel is its type, its size from the chart (Masters -> Sizes; the size
 * fixes the shape), its grades and its certification. The FIELDS are fixed
 * here; their VALUES are the client's grade master (Masters -> Grades), loaded
 * from the database and passed in, so these rules stay pure and testable.
 * Certification is the exception: a yes/no rule, not a list anyone edits.
 */

export const SPEC_FIELDS = ['stoneType', 'sizeId', 'colour', 'clarity', 'certified', 'lab'] as const;
export type SpecField = (typeof SPEC_FIELDS)[number];

/** A spec as forms and JSON carry it. `shape` is never typed: the size decides it. */
export type Spec = Partial<Record<SpecField | 'shape', string | null>>;

/** The fields whose values come from the grade master, and the table each lives in. */
export const MASTER_TABLES = {
  stoneType: 'stone_types', colour: 'colours', clarity: 'clarities', lab: 'labs',
} as const;
export type MasterField = keyof typeof MASTER_TABLES;

export type GradeOption = { name: string; code: string | null };
/** Every picker's values, in the order pickers show them. */
export type Grades = Record<MasterField | 'certified', GradeOption[]>;
export type GradeField = keyof Grades;

export const CERTIFIED: GradeOption[] = [
  { name: 'Certified', code: null }, { name: 'Non-certified', code: null },
];
const CERTIFIED_ALIASES: Record<string, string> = {
  cert: 'Certified', yes: 'Certified', 'non cert': 'Non-certified', 'non-cert': 'Non-certified', no: 'Non-certified',
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
 * A value as typed -> its master name, matched on name or code, ignoring case
 * (so 'lgd' -> Lab Grown, 'fly' -> Fancy Light Yellow); null when the master
 * has no such value. Blank in, blank out (as '').
 */
export function gradeValue(grades: Grades, field: GradeField, raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return '';
  const hit = grades[field].find((v) => v.name.toLowerCase() === t || v.code?.toLowerCase() === t);
  return hit?.name ?? (field === 'certified' ? CERTIFIED_ALIASES[t] ?? null : null);
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

/** Storefront categories for the jewellery catalog. */
export const JEWELLERY_CATEGORIES = ['Gold Vermeil Jewelry'] as const;
