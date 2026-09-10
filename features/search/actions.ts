'use server';

import { auth } from '@/lib/auth/server';
import { search, type Hit } from './queries';

/** Signing out must not leave a searchable index behind. */
export async function searchAction(q: string): Promise<Hit[]> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return [];
  return search(q);
}
