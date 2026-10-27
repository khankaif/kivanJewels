/**
 * Which fields name a stone, and which of them a given shape actually uses.
 *
 * The only shape-dependent field is the sieve: it is a Round measurement, and
 * an Oval is measured in mm. That one fact is a flag on the shape in the
 * master (`diamond_attributes.uses_sieve`); everything else below is fixed,
 * because a stone always has a type, a grade and a certification answer.
 */

export const SPEC_FIELDS = [
  'stoneType', 'colour', 'clarity', 'shape', 'sieveSize', 'mmSize',
  'certified', 'lab',
] as const;
export type SpecField = (typeof SPEC_FIELDS)[number];

export type Spec = Partial<Record<SpecField, string | null>>;

/** Shape values whose stones are sieved, from the master. */
export type SieveShapes = string[];

export const FIELD_LABELS: Record<SpecField, string> = {
  stoneType: 'stone type', shape: 'shape', sieveSize: 'sieve size',
  mmSize: 'MM size', colour: 'colour', clarity: 'clarity',
  certified: 'certification', lab: 'lab',
};

/**
 * Which master list backs each field. Sieve and MM are absent on purpose:
 * 507 and 427 distinct values in the book -- those are measurements, and
 * lot_unit_key() normalizes them on write. Each list key is also the column
 * name the value is stored under.
 */
export const BUCKET_FOR: Partial<Record<SpecField, string>> = {
  stoneType: 'stone_type', shape: 'shape', colour: 'colour',
  clarity: 'clarity', lab: 'lab', certified: 'certified',
};

/** Always asked for. The rest depend on the shape or on certification. */
export const REQUIRED: SpecField[] = ['stoneType', 'shape', 'certified'];

/** True when this value of `certified` means the stone carries a certificate. */
export const isCertified = (v: string | null | undefined) =>
  ['certified', 'cert', 'yes', 'y', 'true'].includes(String(v ?? '').trim().toLowerCase());

export const usesSieve = (shapes: SieveShapes, shape: string | null | undefined) =>
  shapes.some((s) => s.toLowerCase() === String(shape ?? '').trim().toLowerCase());

/** Fields this stone does not have: a sieve on an Oval, a lab on an uncertified stone. */
export function hides(shapes: SieveShapes, spec: Spec, field: SpecField): boolean {
  if (field === 'sieveSize') return !usesSieve(shapes, spec.shape);
  if (field === 'lab') return !isCertified(spec.certified);
  return false;
}

/** Drops values for fields the stone does not have, so they never reach the key. */
export function cleanSpec<T extends Spec>(spec: T, shapes: SieveShapes): T {
  const out = { ...spec };
  for (const f of SPEC_FIELDS) if (hides(shapes, spec, f)) out[f] = null as T[SpecField];
  return out;
}

/** Returns the first problem with a spec, or null. Call it on a cleaned spec. */
export function validateSpec(spec: Spec, shapes: SieveShapes): string | null {
  for (const f of REQUIRED) {
    if (!String(spec[f] ?? '').trim()) return `Enter the ${FIELD_LABELS[f]}.`;
  }
  if (isCertified(spec.certified) && !String(spec.lab ?? '').trim()) {
    return 'Enter the lab that certified it.';
  }
  // A lot with neither a sieve nor an mm has no identity, whatever the shape.
  if (!String(spec.sieveSize ?? '').trim() && !String(spec.mmSize ?? '').trim()) {
    return usesSieve(shapes, spec.shape)
      ? 'Enter the sieve size — that is what identifies the stock.'
      : `Enter the MM size — ${spec.shape ?? 'this shape'} is measured in mm.`;
  }
  return null;
}
