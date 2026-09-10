'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import {
  recordPurchase, receiveInwardMemo, SettlementError, OverdrawError,
} from '@/lib/ledger/movements';

export type ActionState = { error: string } | { ok: string } | null;

const PATHS = ['/', '/stock', '/accounts/bills', '/accounts', '/parties'];

/**
 * Brings diamonds into stock. Two ways in, one form:
 *
 *  - `mode=bill`: goods you own from the moment they arrive. A bill number
 *    posts a payable alongside; without one it is a cash buy, stock only.
 *    Either way the carats land in the owned unit for their full spec.
 *  - `mode=memo`: goods held on approval (jangad in). No payable until the
 *    supplier bills. The parcel stays a parcel -- it goes back to that
 *    supplier if not kept.
 */
export async function addStockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const str = (k: string) => String(form.get(k) ?? '').trim();
  const mode = str('mode');
  const carats = Number(form.get('carats'));
  const rate = Number(form.get('rate'));
  const on = str('on');
  const partyId = str('partyId') || null;
  const notes = str('notes') || undefined;

  if (mode !== 'bill' && mode !== 'memo') return { error: 'Pick how the goods arrived.' };
  if (!Number.isFinite(carats) || carats <= 0) return { error: 'Carats must be greater than zero.' };
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Enter a valid rate.' };
  if (!on) return { error: 'Enter a date.' };
  if (!str('sieveSize') && !str('mmSize')) {
    return { error: 'Enter a sieve or an MM size — that is what identifies the stock.' };
  }

  const spec = {
    stoneType: str('stoneType') || 'Lab Grown',
    shape: str('shape') || null,
    sieveSize: str('sieveSize') || null,
    mmSize: str('mmSize') || null,
    colour: str('colour') || null,
    clarity: str('clarity') || null,
  };

  try {
    if (mode === 'bill') {
      const billNo = str('billNo') || null;
      if (billNo && !partyId) {
        return { error: 'A bill needs a supplier. Pick one, or clear the bill number.' };
      }
      await recordPurchase({ spec, carats, rate, on, partyId, billNo, notes });
      revalidate();
      return {
        ok: billNo
          ? `${carats} ct into purchase stock, ₹${(carats * rate).toLocaleString('en-IN')} payable on ${billNo}.`
          : `${carats} ct into purchase stock.`,
      };
    }

    const memoNo = str('memoNo');
    if (!memoNo) return { error: 'Enter the memo number.' };
    if (!partyId) return { error: 'Select the supplier.' };
    const termsRaw = str('termsDays');
    await receiveInwardMemo({
      memoNo, partyId, issuedOn: on,
      termsDays: termsRaw ? Number(termsRaw) : null,
      agent: str('agent') || null,
      notes,
      lines: [{ carats, rate, ...spec }],
    });
    revalidate();
    return { ok: `${carats} ct into memo stock on ${memoNo} — not yet purchased.` };
  } catch (e) {
    if (e instanceof SettlementError || e instanceof OverdrawError) return { error: e.message };
    if (e instanceof Error && /duplicate key/.test(e.message)) {
      return { error: mode === 'bill' ? 'That bill number is already recorded.' : 'That memo number is already used.' };
    }
    throw e;
  }
}

function revalidate() {
  for (const p of PATHS) revalidatePath(p);
}
