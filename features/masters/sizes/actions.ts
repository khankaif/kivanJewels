'use server';

import { revalidatePath } from 'next/cache';
import { sql, withTx } from '@/db/client';
import { requireAdmin } from '@/lib/auth/server';
import { parseCsv } from '@/lib/csv';
import type { FormState } from '@/components/forms/form-sheet';
import type { ImportState } from '@/components/forms/csv-import';
import { caratsLabel, mmLabel, planSizes, readSize, SIZE_COLUMNS, type SizeFields } from './chart';
import { getShapes, getSizes } from './queries';

const pg = (e: unknown) => e as { code?: string; constraint?: string };
const done = (ok: string): FormState => {
  for (const p of ['/masters/diamonds', '/stock', '/sales', '/accounts/bills']) revalidatePath(p);
  return { ok };
};
const WHO = 'change the size chart';

/**
 * Adds a shape (no `original`) or edits one. A rename follows into its sizes
 * and lots (ON UPDATE CASCADE). The code prefixes new Size IDs only: existing
 * IDs keep theirs, since traders already know them by it.
 */
export async function saveShapeAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin(WHO);
  const original = String(form.get('original') ?? '');
  const shape = String(form.get('shape') ?? '').trim().replace(/\s+/g, ' ');
  const code = String(form.get('code') ?? '').trim().toUpperCase();
  const sort = Number(String(form.get('sortOrder') ?? '').trim() || 0);
  const hasCut = form.get('hasCut') === 'on';
  const active = form.get('active') === 'on';

  if (!/^\S(.{0,28}\S)?$/.test(shape)) return { error: 'Shape name: 1–30 characters.' };
  if (!/^[A-Z]{2,4}$/.test(code)) return { error: 'Code: 2 to 4 letters, e.g. PS for Pear.' };
  if (!Number.isInteger(sort)) return { error: 'Order must be a whole number.' };

  try {
    const rows = original
      ? await sql`UPDATE diamond_shapes SET shape = ${shape}, code = ${code}, sort_order = ${sort},
                    has_cut = ${hasCut}, active = ${active} WHERE shape = ${original} RETURNING shape`
      : await sql`INSERT INTO diamond_shapes (shape, code, sort_order, has_cut, active)
                  VALUES (${shape}, ${code}, ${sort}, ${hasCut}, ${active}) RETURNING shape`;
    if (!rows.length) return { error: `${original} no longer exists.` };
  } catch (e) {
    if (pg(e).code === '23505') {
      return { error: /prefix|code/.test(pg(e).constraint ?? '') ? `Code ${code} is another shape's.` : `${shape} already exists.` };
    }
    throw e;
  }
  return done(original && original !== shape ? `Renamed ${original} to ${shape} everywhere.` : `${shape} saved.`);
}

/** Removes a shape with no sizes. The sizes' foreign key refuses it otherwise. */
export async function deleteShapeAction(form: FormData): Promise<void> {
  await requireAdmin(WHO);
  await sql`DELETE FROM diamond_shapes d WHERE shape = ${String(form.get('shape') ?? '')}
            AND NOT EXISTS (SELECT 1 FROM diamond_sizes s WHERE s.shape = d.shape)`;
  done('');
}

/** Saves the given sizes in one transaction: new ones added, the rest updated by id. */
async function writeSizes(add: (SizeFields & { id: string })[], update: (SizeFields & { id: string })[]) {
  await withTx(async (tx) => {
    const cols = `id text, shape text, length_mm numeric, width_mm numeric, width2_mm numeric,
                  min_ct numeric, max_ct numeric, active boolean`;
    if (update.length) {
      await tx.query(
        `UPDATE diamond_sizes s SET length_mm = u.length_mm, width_mm = u.width_mm, width2_mm = u.width2_mm,
                min_ct = u.min_ct, max_ct = u.max_ct, active = u.active
         FROM jsonb_to_recordset($1::jsonb) AS u(${cols}) WHERE s.id = u.id`,
        [JSON.stringify(update)],
      );
    }
    if (add.length) {
      await tx.query(
        `INSERT INTO diamond_sizes (id, shape, length_mm, width_mm, width2_mm, min_ct, max_ct, active)
         SELECT id, shape, length_mm, width_mm, width2_mm, min_ct, max_ct, active
         FROM jsonb_to_recordset($1::jsonb) AS a(${cols})`,
        [JSON.stringify(add)],
      );
    }
  });
}

const clash = (e: unknown) =>
  pg(e).code === '23505'
    ? (/pkey/.test(pg(e).constraint ?? '') ? 'That Size ID is taken.' : 'A size with that shape, mm and carats already exists.')
    : null;

/** Adds one size (no `originalId`) or edits one. Shape is fixed once saved. */
export async function saveSizeAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin(WHO);
  const editing = String(form.get('originalId') ?? '');
  const [shapes, saved] = await Promise.all([getShapes(), getSizes()]);
  const read = readSize((c) => c === 'active'
    ? (form.get('retired') === 'on' ? 'no' : 'yes')
    : String(form.get(c) ?? ''), shapes);
  if ('error' in read) return { error: read.error };

  const plan = planSizes([{ line: 1, read: { ...read, id: editing || read.id } }], saved, shapes);
  if (plan.errors.length) return { error: plan.errors[0].replace(/^Row 1: /, '') };
  if (!editing && !read.id && !plan.add.length) return { error: 'That size is already in the chart.' };
  try {
    await writeSizes(plan.add, plan.update.map((u) => ({ ...u.after, id: u.id })));
  } catch (e) {
    const msg = clash(e);
    if (msg) return { error: msg };
    throw e;
  }
  const id = plan.add[0]?.id ?? editing;
  return done(plan.add.length ? `${id} added.` : plan.update.length ? `${id} updated.` : 'No changes.');
}

/** Deletes a size no stock or sale uses; the lots' foreign key refuses it otherwise. */
export async function deleteSizeAction(form: FormData): Promise<void> {
  await requireAdmin(WHO);
  await sql`DELETE FROM diamond_sizes s WHERE id = ${String(form.get('id') ?? '')}
            AND NOT EXISTS (SELECT 1 FROM lots l WHERE l.size_id = s.id)
            AND NOT EXISTS (SELECT 1 FROM requirement_lines r WHERE r.size_id = s.id)
            AND NOT EXISTS (SELECT 1 FROM diamond_prices p WHERE p.size_id = s.id)`;
  done('');
}

/**
 * The size chart from a CSV, in two steps: `check` reports what would change
 * and writes nothing; `apply` re-reads the same file and saves it, all of it
 * or none. Stateless: nothing is staged on the server between the steps.
 */
export async function importSizesAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  await requireAdmin(WHO);
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a CSV file.' };
  if (file.size > 512 * 1024) return { error: 'That file is over 512 KB; a size chart is a few hundred rows.' };

  const [header = [], ...rows] = parseCsv(await file.text());
  const cols = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  // Refused, not skipped: a misspelt "lenght_mm" would otherwise import every size without it.
  const unknown = cols.filter((c) => c && !(SIZE_COLUMNS as readonly string[]).includes(c));
  if (unknown.length) return { error: `Unknown column: ${unknown.join(', ')}. Use the columns of Export.` };
  if (!rows.length) return { error: 'The file has no sizes.' };

  const [shapes, saved] = await Promise.all([getShapes(), getSizes()]);
  const plan = planSizes(rows.map((cells, i) => ({
    line: i + 2, // the row number the owner sees in Excel
    read: readSize((c) => cells[cols.indexOf(c)], shapes),
  })), saved, shapes);

  if (plan.errors.length) {
    const more = plan.errors.length > 10 ? `\n…and ${plan.errors.length - 10} more.` : '';
    return { error: `Nothing was imported. Fix these rows and upload again:\n${plan.errors.slice(0, 10).join('\n')}${more}` };
  }
  if (form.get('mode') !== 'apply') {
    const changes = plan.update.map(({ id, before, after }) => {
      const what = [
        mmLabel(before) !== mmLabel(after) && `${mmLabel(before)} → ${mmLabel(after)}`,
        caratsLabel(before) !== caratsLabel(after) && `${caratsLabel(before)} → ${caratsLabel(after)}`,
        before.active !== after.active && (after.active ? 'reactivated' : 'retired'),
      ].filter(Boolean).join(', ');
      return `${id}: ${what}${before.used ? ` (used by ${before.used})` : ''}`;
    });
    return {
      preview: {
        summary: `${plan.add.length} to add, ${plan.update.length} to change, ${plan.unchanged} unchanged.`,
        changes, canApply: plan.add.length + plan.update.length > 0,
      },
    };
  }

  try {
    await writeSizes(plan.add, plan.update.map((u) => ({ ...u.after, id: u.id })));
  } catch (e) {
    const msg = clash(e);
    if (msg) return { error: `Nothing was imported: ${msg}` };
    throw e;
  }
  done('');
  return { ok: `Imported: ${plan.add.length} added, ${plan.update.length} updated, ${plan.unchanged} unchanged.` };
}
