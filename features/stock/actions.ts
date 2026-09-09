'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import { recordPurchase, SettlementError, OverdrawError } from '@/lib/ledger/movements';

export type ActionState = { error: string } | { ok: string } | null;

/**
 * Buys stock into the vault.
 *
 * Two ways goods become yours: bought on a supplier's bill (a payable), or
 * bought outright over the counter (no payable). Either way the carats land in
 * the ONE unit for that shape/sieve/mm, so buying 2.20mm again grows the unit
 * you already have instead of adding a second row to hunt through.
 */
export async function recordPurchaseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const str = (k: string) => String(form.get(k) ?? '').trim();
  const carats = Number(form.get('carats'));
  const rate = Number(form.get('rate'));
  const billNo = str('billNo') || null;
  const partyId = str('partyId') || null;

  if (!Number.isFinite(carats) || carats <= 0) return { error: 'Carats must be greater than zero.' };
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Enter a valid rate.' };
  if (billNo && !partyId) return { error: 'A bill needs a supplier. Pick one, or clear the bill number.' };
  if (!str('sieveSize') && !str('mmSize')) {
    return { error: 'Enter a sieve or an MM size — that is what identifies the stock.' };
  }

  try {
    await recordPurchase({
      spec: {
        stoneType: str('stoneType') || 'Lab Grown',
        shape: str('shape') || null,
        sieveSize: str('sieveSize') || null,
        mmSize: str('mmSize') || null,
      },
      carats, rate, on: str('on'), partyId, billNo,
      notes: str('notes') || undefined,
    });
  } catch (e) {
    if (e instanceof SettlementError || e instanceof OverdrawError) return { error: e.message };
    if (e instanceof Error && /duplicate key/.test(e.message)) {
      return { error: 'That bill number is already recorded.' };
    }
    throw e;
  }

  for (const p of ['/', '/stock', '/movements', '/bills', '/accounts', '/parties']) revalidatePath(p);
  return {
    ok: billNo
      ? `${carats} ct added to stock, and ₹${(carats * rate).toLocaleString('en-IN')} payable on ${billNo}.`
      : `${carats} ct added to stock.`,
  };
}
