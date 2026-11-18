'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { requireAdmin } from '@/lib/auth/server';
import type { FormState } from '@/components/forms/form-sheet';
import { isList, LISTS } from './queries';

const NAME = /^\S(.{0,38}\S)?$/;
const CODE = /^[A-Z0-9][A-Z0-9-]{0,9}$/;
const pg = (e: unknown) => e as { code?: string; constraint?: string };

const refresh = () => {
  for (const p of ['/masters/grades', '/stock', '/sales', '/accounts/bills', '/catalog']) revalidatePath(p);
};

/**
 * Adds a value (no `original`) or edits one. Renaming is allowed even when the
 * value is in use: every lot, sale line and catalog item on it follows through
 * the foreign keys' ON UPDATE CASCADE, in this one statement.
 */
export async function saveGradeAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin('change the grade master');
  const list = String(form.get('list') ?? '');
  if (!isList(list)) return { error: 'Unknown list.' };
  const original = String(form.get('original') ?? '');
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
  const code = String(form.get('code') ?? '').trim().toUpperCase() || null;
  const sort = Number(String(form.get('sortOrder') ?? '').trim() || 0);
  const active = form.get('active') === 'on';

  if (!NAME.test(name)) return { error: 'Name: 1–40 characters.' };
  if (code && !CODE.test(code)) return { error: 'Code: up to 10 letters, digits or dashes, e.g. FLY.' };
  if (!Number.isInteger(sort)) return { error: 'Order must be a whole number.' };

  try {
    // `list` is a key of LISTS (checked above), so naming the table is safe.
    const rows = original
      ? await sql.query(
          `UPDATE ${list} SET name = $1, code = $2, sort_order = $3, active = $4 WHERE name = $5 RETURNING name`,
          [name, code, sort, active, original])
      : await sql.query(
          `INSERT INTO ${list} (name, code, sort_order, active) VALUES ($1, $2, $3, $4) RETURNING name`,
          [name, code, sort, active]);
    if (!rows.length) return { error: `${original} no longer exists.` };
  } catch (e) {
    if (pg(e).code === '23505') {
      return { error: /code/.test(pg(e).constraint ?? '') ? `Code ${code} is already used in this list.` : `${name} already exists.` };
    }
    throw e;
  }
  refresh();
  const label = LISTS[list].label.toLowerCase();
  return { ok: original && original !== name ? `Renamed ${original} to ${name} everywhere.` : `${name} saved to ${label}.` };
}

/** Deletes a value nothing uses. In use, the foreign keys refuse; retire it instead. */
export async function deleteGradeAction(form: FormData): Promise<void> {
  await requireAdmin('change the grade master');
  const list = String(form.get('list') ?? '');
  if (!isList(list)) return;
  try {
    await sql.query(`DELETE FROM ${list} WHERE name = $1`, [String(form.get('name') ?? '')]);
  } catch (e) {
    if (pg(e).code !== '23503') throw e; // came into use since the page loaded: leave it
  }
  refresh();
}
