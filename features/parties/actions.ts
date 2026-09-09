'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { auth } from '@/lib/auth/server';
import { canonicalPartyName } from '@/lib/normalize';

export type PartyState = { error: string } | { ok: string } | null;

async function requireUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
}

const KINDS = new Set(['supplier', 'client', 'both']);

export async function savePartyAction(_prev: PartyState, form: FormData): Promise<PartyState> {
  await requireUser();
  const id = String(form.get('id') ?? '');
  const name = canonicalPartyName(form.get('name'));
  const kind = String(form.get('kind') ?? 'both');
  const terms = Number(form.get('defaultTermsDays'));

  if (!name) return { error: 'Party name is required.' };
  if (!KINDS.has(kind)) return { error: 'Pick supplier, client or both.' };
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
    return { error: 'Credit terms must be a whole number of days between 0 and 365.' };
  }

  const fields = [
    name, kind, terms,
    String(form.get('phone') ?? '').trim() || null,
    String(form.get('email') ?? '').trim() || null,
    String(form.get('gstin') ?? '').trim().toUpperCase() || null,
    String(form.get('notes') ?? '').trim() || null,
    form.get('isActive') === 'off' ? false : true,
    String(form.get('businessName') ?? '').trim() || null,
    String(form.get('contactPerson') ?? '').trim() || null,
    String(form.get('address') ?? '').trim() || null,
    String(form.get('pan') ?? '').trim().toUpperCase() || null,
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
  revalidatePath('/memos');
  return { ok: id ? `${name} updated.` : `${name} added.` };
}
