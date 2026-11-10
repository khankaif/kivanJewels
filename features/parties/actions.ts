'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { requireUser } from '@/lib/auth/server';
import { parseCsv } from '@/lib/csv';
import { PARTY_COLUMNS, readParty, type PartyColumn, type PartyFields } from './party-row';

export type PartyState = { error: string } | { ok: string } | null;

const camel = (c: string) => c.replace(/_(\w)/g, (_, x: string) => x.toUpperCase());

export async function savePartyAction(_prev: PartyState, form: FormData): Promise<PartyState> {
  await requireUser();
  const id = String(form.get('id') ?? '');
  const read = readParty((c) => form.get(camel(c)));
  if ('error' in read) return read;
  const p = read.party;
  const name = p.name;

  const fields = [
    name, p.kind, p.default_terms_days, p.phone, p.email, p.gstin, p.notes,
    form.get('isActive') === 'off' ? false : true,
    p.business_name, p.contact_person, p.address, p.pan,
  ] as const;

  try {
    if (id) {
      await sql`
        UPDATE parties SET name=${fields[0]}, kind=${fields[1]}, default_terms_days=${fields[2]},
          phone=${fields[3]}, email=${fields[4]}, gstin=${fields[5]}, notes=${fields[6]},
          is_active=${fields[7]}, business_name=${fields[8]}, contact_person=${fields[9]},
          address=${fields[10]}, pan=${fields[11]}, updated_at=now()
        WHERE id=${id}`;
    } else {
      await sql`
        INSERT INTO parties (name, kind, default_terms_days, phone, email, gstin, notes, is_active,
                             business_name, contact_person, address, pan)
        VALUES (${fields[0]},${fields[1]},${fields[2]},${fields[3]},${fields[4]},
                ${fields[5]},${fields[6]},${fields[7]},${fields[8]},${fields[9]},${fields[10]},${fields[11]})`;
    }
  } catch (e) {
    if (e instanceof Error && /duplicate key/.test(e.message)) {
      return { error: `A party named "${name}" already exists.` };
    }
    throw e;
  }

  revalidatePath('/parties');
  revalidatePath('/stock');
  revalidatePath('/sales');
  return { ok: id ? `${name} updated.` : `${name} added.` };
}

/**
 * Parties from a CSV, all or nothing: every row is checked first and the file
 * is refused with each bad row named, so a fix-and-re-upload never leaves half
 * a list behind. A name already saved is updated, not duplicated, so the same
 * file can be uploaded twice safely (the import is idempotent).
 */
export async function importPartiesAction(_prev: PartyState, form: FormData): Promise<PartyState> {
  await requireUser();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a CSV file.' };

  const [header = [], ...rows] = parseCsv(await file.text());
  const cols = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  // An unknown header is refused, not skipped: a misspelt "phnoe" column would
  // otherwise import every party with its phone silently blank.
  const unknown = cols.filter((c) => c && !(PARTY_COLUMNS as readonly string[]).includes(c));
  if (!cols.includes('name') || unknown.length) {
    return {
      error: unknown.length
        ? `Unknown column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Use the sample file's headers.`
        : 'The first row must be the column headers, including "name". Download the sample to see them.',
    };
  }
  if (!rows.length) return { error: 'The file has headers but no parties.' };

  const errors: string[] = [];
  const parties: PartyFields[] = [];
  const rowOf = new Map<string, number>();
  rows.forEach((cells, i) => {
    const line = i + 2; // the row number the owner sees in Excel
    const read = readParty((c: PartyColumn) => cells[cols.indexOf(c)]);
    if ('error' in read) return void errors.push(`Row ${line}: ${read.error}`);
    const first = rowOf.get(read.party.name);
    if (first) return void errors.push(`Row ${line}: ${read.party.name} is already on row ${first}.`);
    rowOf.set(read.party.name, line);
    parties.push(read.party);
  });
  if (errors.length) {
    const more = errors.length > 10 ? `\n…and ${errors.length - 10} more.` : '';
    return { error: `Nothing was imported. Fix these rows and upload again:\n${errors.slice(0, 10).join('\n')}${more}` };
  }

  // One statement is one transaction: the whole file lands, or none of it.
  // xmax = 0 only on a freshly inserted row, so it tells added from updated.
  const saved = await sql`
    INSERT INTO parties (name, kind, default_terms_days, phone, email, gstin, pan,
                         business_name, contact_person, address, notes)
    SELECT name, kind, default_terms_days, phone, email, gstin, pan,
           business_name, contact_person, address, notes
    FROM jsonb_to_recordset(${JSON.stringify(parties)}::jsonb) AS p(
      name text, kind text, default_terms_days int, phone text, email text, gstin text, pan text,
      business_name text, contact_person text, address text, notes text)
    -- A column the file leaves out keeps what is saved; a column it has, even
    -- blank, is the new value.
    ON CONFLICT (name) DO UPDATE SET
      kind = CASE WHEN 'kind' = ANY(${cols}::text[]) THEN EXCLUDED.kind ELSE parties.kind END,
      default_terms_days = CASE WHEN 'default_terms_days' = ANY(${cols}::text[]) THEN EXCLUDED.default_terms_days ELSE parties.default_terms_days END,
      phone = CASE WHEN 'phone' = ANY(${cols}::text[]) THEN EXCLUDED.phone ELSE parties.phone END,
      email = CASE WHEN 'email' = ANY(${cols}::text[]) THEN EXCLUDED.email ELSE parties.email END,
      gstin = CASE WHEN 'gstin' = ANY(${cols}::text[]) THEN EXCLUDED.gstin ELSE parties.gstin END,
      pan = CASE WHEN 'pan' = ANY(${cols}::text[]) THEN EXCLUDED.pan ELSE parties.pan END,
      business_name = CASE WHEN 'business_name' = ANY(${cols}::text[]) THEN EXCLUDED.business_name ELSE parties.business_name END,
      contact_person = CASE WHEN 'contact_person' = ANY(${cols}::text[]) THEN EXCLUDED.contact_person ELSE parties.contact_person END,
      address = CASE WHEN 'address' = ANY(${cols}::text[]) THEN EXCLUDED.address ELSE parties.address END,
      notes = CASE WHEN 'notes' = ANY(${cols}::text[]) THEN EXCLUDED.notes ELSE parties.notes END,
      updated_at = now()
    RETURNING (xmax = 0) AS added`;
  const added = saved.filter((r) => r.added).length;

  revalidatePath('/parties');
  return { ok: `Imported ${saved.length}: ${added} added, ${saved.length - added} updated.` };
}
