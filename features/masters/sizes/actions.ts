'use server';

import { revalidatePath } from 'next/cache';
import { sql, withTx } from '@/db/client';
import { requireUser } from '@/lib/auth/server';
import { bandProblem, estimateMm, sizeId, standardBands } from './chart';

export type SizeState = { error: string } | { ok: string } | null;

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  return s ? Number(s) : null;
};
const pgCode = (e: unknown) => (e as { code?: string })?.code;
const done = (ok: string): SizeState => {
  for (const p of ['/masters/diamonds', '/stock', '/sales', '/accounts/bills']) revalidatePath(p);
  return { ok };
};

/**
 * Adds a shape (no `original`) or edits one: prefix and 1 ct reference, and
 * optionally re-estimates its sizes' mm. A shape's prefix is fixed once sizes
 * use it, since Size IDs carry it (RD-100) and IDs are permanent.
 */
export async function saveShapeAction(_prev: SizeState, form: FormData): Promise<SizeState> {
  await requireUser();
  const original = String(form.get('original') ?? '');
  const shape = original || String(form.get('shape') ?? '').trim().replace(/\s+/g, ' ');
  const prefix = String(form.get('prefix') ?? '').trim().toUpperCase();
  const length = num(form.get('lengthMm'));
  const width = num(form.get('widthMm'));
  const reestimate = form.get('reestimate') === 'on';

  if (!/^\S(.{0,28}\S)?$/.test(shape)) return { error: 'Shape name: 1–30 characters.' };
  if (!/^[A-Z]{2,3}$/.test(prefix)) return { error: 'Prefix: 2 or 3 letters, e.g. HM for HM-010.' };
  if ((length === null) !== (width === null)) return { error: 'Enter both 1 ct length and width, or neither.' };
  if (length !== null && !(length > 0 && width! > 0)) return { error: 'Length and width must be above 0 mm.' };
  if (reestimate && length === null) return { error: 'Enter the 1 ct length and width to re-estimate sizes.' };

  try {
    const reestimated = await withTx(async (tx) => {
      if (!original) {
        await tx.query(
          `INSERT INTO diamond_shapes (shape, prefix, length_mm, width_mm, sort_order)
           SELECT $1, $2, $3, $4, COALESCE(MAX(sort_order), 0) + 1 FROM diamond_shapes`,
          [shape, prefix, length, width],
        );
        return 0;
      }
      const { rows: [old] } = await tx.query(
        `SELECT prefix, (SELECT count(*)::int FROM diamond_sizes WHERE shape = $1) AS sizes
         FROM diamond_shapes WHERE shape = $1`, [shape],
      );
      if (!old) throw new Refusal(`${shape} no longer exists.`);
      if (old.sizes && old.prefix !== prefix) {
        throw new Refusal(`${shape} has ${old.sizes} sizes named ${old.prefix}-…, so its prefix can't change.`);
      }
      await tx.query(
        'UPDATE diamond_shapes SET prefix = $1, length_mm = $2, width_mm = $3 WHERE shape = $4',
        [prefix, length, width, shape],
      );
      if (!reestimate) return 0;
      const { rows } = await tx.query('SELECT id, nominal_ct FROM diamond_sizes WHERE shape = $1', [shape]);
      const est = rows.map((r) => ({
        id: r.id, ...estimateMm(Number(r.nominal_ct), { length_mm: length!, width_mm: width! }),
      }));
      await tx.query(
        `UPDATE diamond_sizes s SET est_length_mm = e.est_length_mm, est_width_mm = e.est_width_mm
         FROM jsonb_to_recordset($1::jsonb) AS e(id text, est_length_mm numeric, est_width_mm numeric)
         WHERE s.id = e.id`,
        [JSON.stringify(est)],
      );
      return est.length;
    });
    return done(reestimated ? `${shape} saved; ${reestimated} sizes re-estimated.` : `${shape} saved.`);
  } catch (e) {
    if (e instanceof Refusal) return { error: e.message };
    if (pgCode(e) === '23505') {
      return { error: /prefix/.test(String((e as Error).message)) ? `Prefix ${prefix} is already another shape's.` : `${shape} already exists.` };
    }
    throw e;
  }
}
class Refusal extends Error {}

/** Removes a shape nothing uses. The sizes' foreign key refuses it otherwise. */
export async function deleteShapeAction(form: FormData): Promise<void> {
  await requireUser();
  await sql`DELETE FROM diamond_shapes d WHERE shape = ${String(form.get('shape') ?? '')}
            AND NOT EXISTS (SELECT 1 FROM diamond_sizes s WHERE s.shape = d.shape)`;
  done('');
}

/**
 * Creates a size, or edits one (`originalId`). Blank nominal = the band's
 * midpoint; blank mm = estimated from the shape's 1 ct reference; blank Size
 * ID = prefix + nominal (RD-100). Shape and ID are fixed once saved.
 */
export async function saveSizeAction(_prev: SizeState, form: FormData): Promise<SizeState> {
  await requireUser();
  const editing = String(form.get('originalId') ?? '');
  const [shape] = editing
    ? await sql`SELECT d.* FROM diamond_sizes s JOIN diamond_shapes d ON d.shape = s.shape WHERE s.id = ${editing}`
    : await sql`SELECT * FROM diamond_shapes WHERE shape = ${String(form.get('shape') ?? '')}`;
  if (!shape) return { error: editing ? `${editing} no longer exists.` : 'Pick a shape.' };

  const min = num(form.get('minCt'));
  const max = num(form.get('maxCt'));
  const nominal = num(form.get('nominalCt')) ?? (min !== null && max !== null ? Math.round(((min + max) / 2) * 1e4) / 1e4 : null);
  const problem = bandProblem({ min_ct: min ?? undefined, max_ct: max ?? undefined, nominal_ct: nominal ?? undefined });
  if (problem) return { error: problem };

  let length = num(form.get('lengthMm'));
  let width = num(form.get('widthMm'));
  if (length === null && width === null) {
    if (shape.length_mm === null) {
      return { error: `${shape.shape} has no 1 ct reference size: enter the mm, or add the reference under Shapes.` };
    }
    ({ est_length_mm: length, est_width_mm: width } = estimateMm(nominal!, {
      length_mm: Number(shape.length_mm), width_mm: Number(shape.width_mm),
    }));
  }
  if (!(length! > 0 && width! > 0)) return { error: 'Enter length and width above 0 mm, or leave both blank to estimate.' };

  const id = editing || String(form.get('id') ?? '').trim().toUpperCase() || sizeId(shape.prefix, nominal!);
  if (!id) return { error: `Enter a Size ID: ${nominal} ct isn't whole hundredths, so none can be made from it.` };
  if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(id)) return { error: 'Size ID: letters, digits and dashes, e.g. RD-100.' };
  const notes = String(form.get('notes') ?? '').trim() || null;

  try {
    if (editing) {
      await sql`
        UPDATE diamond_sizes SET min_ct = ${min}, max_ct = ${max}, nominal_ct = ${nominal},
          est_length_mm = ${length}, est_width_mm = ${width}, notes = ${notes}
        WHERE id = ${id}`;
    } else {
      await sql`
        INSERT INTO diamond_sizes (id, shape, min_ct, max_ct, nominal_ct, est_length_mm, est_width_mm, notes)
        VALUES (${id}, ${shape.shape}, ${min}, ${max}, ${nominal}, ${length}, ${width}, ${notes})`;
    }
  } catch (e) {
    if (pgCode(e) === '23505') return { error: `${id} already exists.` };
    if (pgCode(e) === '23P01') {
      // The exclusion constraint refused it; name the band it hit.
      const [clash] = await sql`
        SELECT id FROM diamond_sizes
        WHERE shape = ${shape.shape} AND id <> ${id}
          AND numrange(min_ct, max_ct, CASE WHEN nominal_ct = max_ct THEN '[]' ELSE '[)' END)
           && numrange(${min}, ${max}, CASE WHEN ${nominal}::numeric = ${max}::numeric THEN '[]' ELSE '[)' END)
        LIMIT 1`;
      return { error: `${id}: carat band overlaps ${clash?.id ?? 'another size'}.` };
    }
    throw e;
  }
  return done(`${id} ${editing ? 'updated' : 'created'}.`);
}

/** Deletes a size no stock or sale uses; the lots' foreign key refuses it otherwise. */
export async function deleteSizeAction(form: FormData): Promise<void> {
  await requireUser();
  await sql`DELETE FROM diamond_sizes s WHERE id = ${String(form.get('id') ?? '')}
            AND NOT EXISTS (SELECT 1 FROM lots l WHERE l.size_id = s.id)
            AND NOT EXISTS (SELECT 1 FROM requirement_lines r WHERE r.size_id = s.id)`;
  done('');
}

/** The standard 0.05–2.00 ct grid for the chosen shapes. Existing or overlapping sizes are left alone. */
export async function generateSizesAction(_prev: SizeState, form: FormData): Promise<SizeState> {
  await requireUser();
  const names = form.getAll('shape').map(String);
  if (!names.length) return { error: 'Pick at least one shape.' };

  const shapes = await sql`
    SELECT shape, prefix, length_mm, width_mm FROM diamond_shapes
    WHERE shape = ANY(${names}::text[]) AND length_mm IS NOT NULL`;
  const rows = (shapes as any[]).flatMap((s) =>
    standardBands().map((b) => ({
      id: sizeId(s.prefix, b.nominal_ct), shape: s.shape, ...b,
      ...estimateMm(b.nominal_ct, { length_mm: Number(s.length_mm), width_mm: Number(s.width_mm) }),
    })),
  );
  // DO NOTHING with no target skips a row that hits ANY unique or exclusion
  // constraint: a taken ID, or a band overlapping one the owner made by hand.
  const created = await sql`
    INSERT INTO diamond_sizes (id, shape, min_ct, max_ct, nominal_ct, est_length_mm, est_width_mm)
    SELECT id, shape, min_ct, max_ct, nominal_ct, est_length_mm, est_width_mm
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(
      id text, shape text, min_ct numeric, max_ct numeric, nominal_ct numeric,
      est_length_mm numeric, est_width_mm numeric)
    ON CONFLICT DO NOTHING
    RETURNING id`;
  return done(created.length ? `Created ${created.length} sizes.` : 'All standard sizes already exist.');
}
