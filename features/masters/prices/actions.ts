'use server';

import { revalidatePath } from 'next/cache';
import { sql, withTx } from '@/db/client';
import { requireAdmin } from '@/lib/auth/server';
import { parseCsv } from '@/lib/csv';
import type { FormState } from '@/components/forms/form-sheet';
import type { ImportState } from '@/components/forms/csv-import';
import { getGrades } from '@/features/masters/grades/queries';
import { getSizes } from '@/features/masters/sizes/queries';
import { parsePrice, planPrices, qualityLabel } from './grid';
import { getPriceMap, getQualities } from './queries';

const WHO = 'change catalog prices';
const pg = (e: unknown) => e as { code?: string };
const refresh = () => revalidatePath('/masters/prices');

/** Adds a quality option, or edits its order / active flag. The pair itself is its identity. */
export async function saveQualityAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin(WHO);
  const editing = form.get('editing') === 'on';
  const colour = String(form.get('colour') ?? '');
  const clarity = String(form.get('clarity') ?? '');
  const sort = Number(String(form.get('sortOrder') ?? '').trim() || 0);
  const active = form.get('active') === 'on';
  if (!colour || !clarity) return { error: 'Pick a colour and a clarity.' };
  if (!Number.isInteger(sort)) return { error: 'Order must be a whole number.' };
  const label = qualityLabel({ colour, clarity });
  try {
    if (editing) {
      await sql`UPDATE quality_options SET sort_order = ${sort}, active = ${active}
                WHERE colour = ${colour} AND clarity = ${clarity}`;
    } else {
      await sql`INSERT INTO quality_options (colour, clarity, sort_order, active)
                VALUES (${colour}, ${clarity}, ${sort}, ${active})`;
    }
  } catch (e) {
    if (pg(e).code === '23505') return { error: `${label} is already an option.` };
    if (pg(e).code === '23503') return { error: 'That colour or clarity is no longer in the grade master.' };
    throw e;
  }
  refresh();
  return { ok: `${label} saved.` };
}

/** Deletes an option with no prices. With prices, retire it instead (the foreign key refuses). */
export async function deleteQualityAction(form: FormData): Promise<void> {
  await requireAdmin(WHO);
  await sql`DELETE FROM quality_options q
            WHERE colour = ${String(form.get('colour') ?? '')} AND clarity = ${String(form.get('clarity') ?? '')}
              AND NOT EXISTS (SELECT 1 FROM diamond_prices p WHERE p.colour = q.colour AND p.clarity = q.clarity)`;
  refresh();
}

/**
 * A price grid from CSV in two steps: `check` reports what would change and
 * writes nothing; `apply` re-reads the same file and saves it, all or none.
 */
export async function importPricesAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  await requireAdmin(WHO);
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a CSV file.' };
  if (file.size > 512 * 1024) return { error: 'That file is over 512 KB; export a fresh grid and edit that.' };

  const [header = [], ...rows] = parseCsv(await file.text());
  if (!rows.length) return { error: 'The file has no rows.' };
  const [grades, sizes, qualities, saved] = await Promise.all([
    getGrades({ retired: true }), getSizes(), getQualities(), getPriceMap(),
  ]);
  const plan = planPrices(header, rows, {
    stoneTypes: grades.stoneType, sizeIds: new Set(sizes.map((s) => s.id)), qualities, saved,
  });

  if (plan.errors.length) {
    const more = plan.errors.length > 10 ? `\n…and ${plan.errors.length - 10} more.` : '';
    return { error: `Nothing was imported. Fix these and upload again:\n${plan.errors.slice(0, 10).join('\n')}${more}` };
  }
  const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  if (form.get('mode') !== 'apply') {
    const name = (k: { stone_type: string; size_id: string; colour: string; clarity: string }) =>
      `${k.stone_type} ${k.size_id} ${qualityLabel(k)}`;
    return {
      preview: {
        summary: `${plan.set.filter((s) => s.before === null).length} new, `
          + `${plan.set.filter((s) => s.before !== null).length} changed, ${plan.remove.length} removed, `
          + `${plan.unchanged} unchanged.`,
        changes: [
          ...plan.set.filter((s) => s.before !== null).map((s) => `${name(s)}: ${rupees(s.before!)} → ${rupees(s.price_per_ct)}`),
          ...plan.remove.map((r) => `${name(r)}: ${rupees(r.before)} → removed`),
        ],
        canApply: plan.set.length + plan.remove.length > 0,
      },
    };
  }

  await withTx(async (tx) => {
    if (plan.remove.length) {
      await tx.query(
        `DELETE FROM diamond_prices p USING jsonb_to_recordset($1::jsonb)
           AS r(stone_type text, size_id text, colour text, clarity text)
         WHERE (p.stone_type, p.size_id, p.colour, p.clarity) = (r.stone_type, r.size_id, r.colour, r.clarity)`,
        [JSON.stringify(plan.remove)],
      );
    }
    if (plan.set.length) {
      await tx.query(
        `INSERT INTO diamond_prices (stone_type, size_id, colour, clarity, price_per_ct)
         SELECT stone_type, size_id, colour, clarity, price_per_ct FROM jsonb_to_recordset($1::jsonb)
           AS s(stone_type text, size_id text, colour text, clarity text, price_per_ct numeric)
         ON CONFLICT (stone_type, size_id, colour, clarity) DO UPDATE SET
           price_per_ct = EXCLUDED.price_per_ct, updated_at = now(),
           updated_by = NULLIF(current_setting('app.actor', true), '')`,
        [JSON.stringify(plan.set)],
      );
    }
  });
  refresh();
  return { ok: `Prices saved: ${plan.set.length} set, ${plan.remove.length} removed.` };
}

/** One cell of the grid: a number sets the price, blank removes it. Returns the saved value or an error. */
export async function setPriceAction(input: {
  stoneType: string; sizeId: string; colour: string; clarity: string; price: string;
}): Promise<{ ok: number | null } | { error: string }> {
  await requireAdmin(WHO);
  const price = parsePrice(input.price);
  if (Number.isNaN(price)) return { error: `"${input.price}" is not a price.` };
  const key = [input.stoneType, input.sizeId, input.colour, input.clarity];
  try {
    if (price === null) {
      await sql`DELETE FROM diamond_prices WHERE stone_type = ${key[0]} AND size_id = ${key[1]}
                AND colour = ${key[2]} AND clarity = ${key[3]}`;
    } else {
      await sql`
        INSERT INTO diamond_prices (stone_type, size_id, colour, clarity, price_per_ct)
        VALUES (${key[0]}, ${key[1]}, ${key[2]}, ${key[3]}, ${price})
        ON CONFLICT (stone_type, size_id, colour, clarity) DO UPDATE SET
          price_per_ct = EXCLUDED.price_per_ct, updated_at = now()`;
    }
  } catch (e) {
    if (pg(e).code === '23503') return { error: 'That size, stone type or quality is no longer in the masters.' };
    throw e;
  }
  refresh();
  return { ok: price };
}
