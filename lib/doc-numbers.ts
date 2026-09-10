import { q, type Ctx } from '@/lib/ledger/core';

export type DocKind = 'memo_out' | 'memo_in' | 'invoice';

/**
 * The next number in one of our own document series.
 *
 * Pass the transaction context so the number is taken inside the same
 * transaction as the document it names: if the save rolls back, the number
 * rolls back with it and nothing is skipped.
 *
 * Supplier bill numbers are NOT issued here -- those come off the supplier's
 * paper, and in Receive stock a blank bill number still means a cash purchase.
 */
export async function nextDocNo(kind: DocKind, ctx?: Ctx): Promise<string> {
  const rows = await q(ctx)('SELECT next_doc_no($1) AS no', [kind]);
  return rows[0].no as string;
}

/** Uses what was typed, or issues the next number when the field was left blank. */
export const docNoOr = async (typed: string, kind: DocKind, ctx?: Ctx) =>
  typed.trim() || (await nextDocNo(kind, ctx));
