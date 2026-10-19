'use server';

import { revalidatePath } from 'next/cache';
import { sql, withTx } from '@/db/client';
import { requireUser } from '@/lib/auth/server';
import { BUCKET_FOR } from '@/lib/spec-rules';

export type MasterState = { error: string } | { ok: string } | null;

/** Buckets are rows now, so the whitelist is a lookup, not a constant. */
async function checkBucket(key: string): Promise<string> {
  const rows = await sql`SELECT key FROM attribute_buckets WHERE key = ${key}`;
  if (!rows.length) throw new Error(`bad attribute type: ${key}`);
  return key;
}

export async function addDiamondAttributeAction(_prev: MasterState, form: FormData): Promise<MasterState> {
  await requireUser();
  const type = await checkBucket(String(form.get('attributeType') ?? ''));
  const value = String(form.get('value') ?? '').trim();
  if (!value) return { error: 'Enter a value.' };

  try {
    await sql`INSERT INTO diamond_attributes (attribute_type, value) VALUES (${type}, ${value})`;
  } catch (e) {
    if (e instanceof Error && /duplicate key/.test(e.message)) {
      return { error: `"${value}" is already in the ${type} list.` };
    }
    throw e;
  }
  revalidatePath('/masters/diamonds');
  return { ok: `${value} added.` };
}

export async function removeDiamondAttributeAction(form: FormData): Promise<void> {
  await requireUser();
  const id = String(form.get('id') ?? '');
  // Values already used on existing lots stay on those lots as plain text --
  // this only stops the value from being offered on the NEXT purchase.
  await sql`DELETE FROM diamond_attributes WHERE id = ${id}`;
  revalidatePath('/masters/diamonds');
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;

export async function addBucketAction(_prev: MasterState, form: FormData): Promise<MasterState> {
  await requireUser();
  const label = String(form.get('label') ?? '').trim();
  if (!label) return { error: 'Name the list.' };
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!KEY_RE.test(key)) return { error: 'Use a name with some letters in it.' };

  try {
    await sql`
      INSERT INTO attribute_buckets (key, label, sort_order)
      VALUES (${key}, ${label}, (SELECT COALESCE(MAX(sort_order),0) + 1 FROM attribute_buckets))`;
  } catch (e) {
    if (e instanceof Error && /duplicate key/.test(e.message)) return { error: `"${label}" already exists.` };
    throw e;
  }
  revalidatePath('/masters/diamonds');
  return { ok: `${label} list added.` };
}

export async function removeBucketAction(form: FormData): Promise<void> {
  await requireUser();
  const key = String(form.get('key') ?? '');
  // Preset buckets are wired to a spec field by name; deleting one would take
  // a form field with it, so the WHERE clause refuses.
  await sql`DELETE FROM diamond_attributes WHERE attribute_type = ${key}
            AND EXISTS (SELECT 1 FROM attribute_buckets WHERE key = ${key} AND NOT is_preset)`;
  await sql`DELETE FROM attribute_buckets WHERE key = ${key} AND NOT is_preset`;
  revalidatePath('/masters/diamonds');
}

/** Shapes only: are stones of this shape sieved, or measured in mm? */
export async function setUsesSieveAction(form: FormData): Promise<void> {
  await requireUser();
  const id = String(form.get('id') ?? '');
  const on = String(form.get('usesSieve') ?? '') === '1';
  await sql`
    UPDATE diamond_attributes SET uses_sieve = ${on}
    WHERE id = ${id} AND attribute_type = 'shape'`;
  for (const p of ['/masters/diamonds', '/stock', '/sales', '/accounts/bills']) revalidatePath(p);
}

/**
 * Rewrites every stored copy of a stray value to the master spelling.
 *
 * Changing shape or type changes a lot's unit key, which can collide with an
 * owned unit that already holds that identity. The unique index catches it and
 * the whole rewrite rolls back -- merging two units means merging two cost
 * averages, which is a decision, not a cleanup.
 */
async function rewrite(bucket: string, from: string, to: string) {
  // Interpolated into SQL below, so it must come from the fixed spec lists.
  const col = Object.values(BUCKET_FOR).find((b) => b === bucket);
  if (!col) throw new Error(`bucket ${bucket} has no column`);
  await withTx(async (c) => {
    for (const table of ['lots', 'requirement_lines']) {
      const { rows } = await c.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`, [table, col]);
      if (!rows.length) continue;
      await c.query(
        `UPDATE ${table} SET ${col} = $1 WHERE lower(btrim(${col})) = lower(btrim($2))`,
        [to, from],
      );
    }
  });
}

/** Takes a value the book already uses into the master as-is. */
export async function adoptValueAction(form: FormData): Promise<void> {
  await requireUser();
  const bucket = await checkBucket(String(form.get('bucket') ?? ''));
  const value = String(form.get('value') ?? '').trim();
  if (!value) return;
  await sql`
    INSERT INTO diamond_attributes (attribute_type, value, sort_order)
    VALUES (${bucket}, ${value}, (
      SELECT COALESCE(MAX(sort_order), 0) + 1 FROM diamond_attributes WHERE attribute_type = ${bucket}))
    ON CONFLICT DO NOTHING`;
  revalidatePath('/masters/diamonds');
}

/** Maps a stray spelling onto a master value and rewrites the rows that use it. */
export async function aliasValueAction(_prev: MasterState, form: FormData): Promise<MasterState> {
  await requireUser();
  const bucket = await checkBucket(String(form.get('bucket') ?? ''));
  const alias = String(form.get('value') ?? '').trim();
  const target = String(form.get('target') ?? '').trim();
  if (!alias || !target) return { error: 'Pick the master value to map it to.' };

  const [known] = await sql`
    SELECT 1 FROM diamond_attributes WHERE attribute_type = ${bucket} AND value = ${target}`;
  if (!known) return { error: `"${target}" is not in the ${bucket} master.` };

  try {
    await sql`
      INSERT INTO attribute_aliases (bucket, alias, value)
      VALUES (${bucket}, ${alias.toLowerCase()}, ${target})
      ON CONFLICT (bucket, alias) DO UPDATE SET value = EXCLUDED.value`;
    await rewrite(bucket, alias, target);
  } catch (e) {
    if (e instanceof Error && /duplicate key|unit_uniq/.test(e.message)) {
      return {
        error: `Renaming "${alias}" to "${target}" would merge two owned stock units, `
             + 'which would average their cost rates. Move the carats first.',
      };
    }
    throw e;
  }
  for (const p of ['/masters/diamonds', '/stock', '/sales']) revalidatePath(p);
  return { ok: `"${alias}" now reads as ${target}.` };
}
