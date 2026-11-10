import { sql } from '@/db/client';
import {
  cleanSpec, FIELD_LABELS, GRADES, gradeValue, SPEC_FIELDS, validateSpec,
  type GradeField, type Spec,
} from '@/lib/spec-rules';

export type StoredSpec = {
  stoneType: string; shape: string; sizeId: string;
  colour: string | null; clarity: string | null;
  lab: string | null; certified: string | null;
};
export type SpecResult = { ok: true; spec: StoredSpec } | { ok: false; error: string };

/**
 * Holds a spec to the rules: every grade must be a value of its fixed list
 * (any casing, or an alias such as LGD), and the size must be in the chart.
 * The shape is read off the size, never trusted from the caller, and the
 * database's (size_id, shape) foreign key backs that up.
 */
export async function checkSpec(input: Spec): Promise<SpecResult> {
  const raw: Spec = {};
  for (const f of SPEC_FIELDS) raw[f] = String(input[f] ?? '').trim() || null;
  for (const f of Object.keys(GRADES) as GradeField[]) {
    if (!raw[f]) continue;
    const v = gradeValue(f, raw[f]);
    if (!v) return { ok: false, error: `"${raw[f]}" is not a ${FIELD_LABELS[f]} this book uses.` };
    raw[f] = v;
  }

  const spec = cleanSpec(raw);
  const error = validateSpec(spec);
  if (error) return { ok: false, error };

  const [size] = await sql`SELECT id, shape FROM diamond_sizes WHERE id = ${spec.sizeId!.toUpperCase()}`;
  if (!size) return { ok: false, error: `Size ${spec.sizeId} is not in the size chart (Masters → Diamonds).` };

  return {
    ok: true,
    spec: {
      stoneType: spec.stoneType!, shape: size.shape, sizeId: size.id,
      colour: spec.colour || null, clarity: spec.clarity || null,
      lab: spec.lab || null, certified: spec.certified || null,
    },
  };
}

/** Same rules, for a spec read off a form. */
export async function specFromForm(form: FormData, prefix = ''): Promise<SpecResult> {
  const input: Spec = {};
  for (const f of SPEC_FIELDS) input[f] = String(form.get(prefix + f) ?? '');
  return checkSpec(input);
}
