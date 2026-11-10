'use server';

import { requireUser } from '@/lib/auth/server';
import { parseShorthand } from './shorthand';

/** Shorthand entry for the stock and sale forms. Reads only; saves nothing. */
export async function parseShorthandAction(line: string) {
  await requireUser();
  return parseShorthand(line.slice(0, 200));
}
