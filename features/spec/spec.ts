import { sql } from '@/db/client';
import {
  cleanSpec, FIELD_LABELS, gradeValue, SPEC_FIELDS, validateSpec,
  type GradeField, type Grades, type Spec,
} from '@/lib/spec-rules';
import { getGrades } from '@/features/masters/grades/queries';

export type StoredSpec = {
  stoneType: string; shape: string; sizeId: string;
  colour: string | null; clarity: string | null;
  lab: string | null; certified: string | null;
};
export type SpecResult = { ok: true; spec: StoredSpec } | { ok: false; error: string };

/**
 * Holds a spec to the rules: every grade must be a value of the grade master
 * (any casing, or its code such as LGD), and the size must be in the chart.
 * Retired values pass: pickers no longer offer them, but stock already on one
 * must still move. The lots' foreign keys back the master up. Pass `grades`
 * (read with `{ retired: true }`) when checking many specs, to read it once.
 * The shape is read off the size, never trusted from the caller, and the
 * database's (size_id, shape) foreign key backs that up.
 */
export async function checkSpec(input: Spec, grades?: Grades): Promise<SpecResult> {
  const lists = grades ?? await getGrades({ retired: true });
  const raw: Spec = {};
  for (const f of SPEC_FIELDS) raw[f] = String(input[f] ?? '').trim() || null;
  for (const f of Object.keys(lists) as GradeField[]) {
    if (!raw[f]) continue;
    const v = gradeValue(lists, f, raw[f]);
    if (!v) return { ok: false, error: `"${raw[f]}" is not a ${FIELD_LABELS[f]} this book uses.` };
    raw[f] = v;
  }

  const spec = cleanSpec(raw);
  const error = validateSpec(spec);
  if (error) return { ok: false, error };

  const [size] = await sql`SELECT id, shape FROM diamond_sizes WHERE id = ${spec.sizeId!.toUpperCase()}`;
  if (!size) return { ok: false, error: `Size ${spec.sizeId} is not in the size chart (Masters → Sizes).` };

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
