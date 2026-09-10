import { sql } from '@/db/client';
import { cleanSpec, validateSpec, SPEC_FIELDS, type Spec, type SpecField } from '@/lib/spec-rules';
import { getSieveShapes } from './queries';

export type SpecResult = { ok: true; spec: StoredSpec } | { ok: false; error: string };

export type StoredSpec = {
  stoneType: string; shape: string | null; sieveSize: string | null;
  mmSize: string | null; colour: string | null; clarity: string | null;
  lab: string | null; certified: string | null;
};

/**
 * Which master list backs each field. Sieve and MM are absent on purpose:
 * 507 and 427 distinct values in the book -- those are measurements, and
 * lot_unit_key() normalizes them on write.
 */
const BUCKET_FOR: Partial<Record<SpecField, string>> = {
  stoneType: 'stone_type', shape: 'shape', colour: 'colour',
  clarity: 'clarity', lab: 'lab', certified: 'certified',
};

/**
 * Resolves every master-backed value to its master spelling, in one round trip.
 *
 * `master_value()` accepts the exact value, any casing of it, or a registered
 * alias ('RBC' -> 'Round', 'Lab Grown Diamond' -> 'Lab Grown'). Anything it
 * cannot resolve is refused: the master is the only source of these values, so
 * a stray spelling is a data error, not a new option.
 */
async function toMasterValues(raw: Spec): Promise<{ spec: Spec } | { error: string }> {
  const pairs = Object.entries(BUCKET_FOR)
    .filter(([f]) => String(raw[f as SpecField] ?? '').trim())
    .map(([f, bucket]) => ({ field: f as SpecField, bucket, value: String(raw[f as SpecField]) }));
  if (!pairs.length) return { spec: { ...raw } };

  const rows = await sql`
    SELECT p.field, p.value, master_value(p.bucket, p.value) AS resolved
    FROM jsonb_to_recordset(${JSON.stringify(pairs)}::jsonb)
      AS p(field text, bucket text, value text)`;

  const out: Spec = { ...raw };
  for (const r of rows as { field: SpecField; value: string; resolved: string | null }[]) {
    if (!r.resolved) {
      return {
        error: `"${r.value}" is not in the ${r.field} master. Add it there, or map it as an alias.`,
      };
    }
    out[r.field] = r.resolved;
  }
  return { spec: out };
}

const store = (cleaned: Spec): StoredSpec => ({
  stoneType: cleaned.stoneType || 'Lab Grown',
  shape: cleaned.shape || null, sieveSize: cleaned.sieveSize || null,
  mmSize: cleaned.mmSize || null, colour: cleaned.colour || null,
  clarity: cleaned.clarity || null, lab: cleaned.lab || null,
  certified: cleaned.certified || null,
});

/** Same rules, for a spec that came from JSON rather than a form (sale lines). */
export async function checkSpec(input: Spec): Promise<SpecResult> {
  const raw: Spec = {};
  for (const f of SPEC_FIELDS) raw[f] = String(input[f] ?? '').trim() || null;

  const resolved = await toMasterValues(raw);
  if ('error' in resolved) return { ok: false, error: resolved.error };

  const sieveShapes = await getSieveShapes();
  const cleaned = cleanSpec(resolved.spec, sieveShapes);
  const error = validateSpec(cleaned, sieveShapes);
  if (error) return { ok: false, error };
  return { ok: true, spec: store(cleaned) };
}

/**
 * Reads a spec off a form and holds it to the masters -- the one place three
 * server actions used to each keep their own "sieve or mm" check.
 *
 * Fields the shape does not use are dropped, not trusted: a stale sieve on an
 * Oval would otherwise land in the unit key and split the stock in two.
 */
export async function specFromForm(form: FormData, prefix = ''): Promise<SpecResult> {
  const input: Spec = {};
  for (const f of SPEC_FIELDS) input[f] = String(form.get(prefix + f) ?? '').trim() || null;
  return checkSpec(input);
}
