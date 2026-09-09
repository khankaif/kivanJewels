'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { auth } from '@/lib/auth/server';
import { ATTRIBUTE_TYPES, type AttributeType } from './queries';

export type MasterState = { error: string } | { ok: string } | null;

async function requireUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
}

function checkType(t: string): AttributeType {
  if (!ATTRIBUTE_TYPES.includes(t as AttributeType)) throw new Error(`bad attribute type: ${t}`);
  return t as AttributeType;
}

export async function addDiamondAttributeAction(_prev: MasterState, form: FormData): Promise<MasterState> {
  await requireUser();
  const type = checkType(String(form.get('attributeType') ?? ''));
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
