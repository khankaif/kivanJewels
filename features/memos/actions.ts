'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import {
  returnFromMemo, billMemoLine, OverdrawError, SettlementError,
} from '@/lib/ledger/movements';

export type ActionState = { error: string } | { ok: string } | null;

async function requireUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
}

/** Turns domain errors into something a user can act on; rethrows the rest. */
function toMessage(e: unknown): string {
  if (e instanceof OverdrawError) {
    const m = /balance ([\d.]+), requested ([\d.]+)/.exec(e.message);
    return m
      ? `Not enough stock: that lot holds ${m[1]} ct but ${m[2]} ct was requested. ` +
        `Carats already issued to a client are not in the vault.`
      : 'Not enough stock in that lot.';
  }
  if (e instanceof SettlementError) return e.message;
  if (e instanceof Error && /duplicate key/.test(e.message)) return 'That memo number is already used.';
  throw e;
}

const revalidateAll = () => {
  for (const p of ['/', '/memos', '/stock', '/accounts', '/parties']) revalidatePath(p);
};


/**
 * Settles part or all of a memo line. Works in both directions:
 * return sends goods back the way they came; bill creates a receivable on an
 * outward memo and a payable on an inward one.
 */
export async function settleLineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const memoLineId = String(form.get('memoLineId') ?? '');
  const action = String(form.get('action') ?? '');
  const carats = Number(form.get('carats'));
  const on = String(form.get('on') ?? '');
  const invoiceNo = String(form.get('invoiceNo') ?? '').trim();
  const rateRaw = String(form.get('rate') ?? '').trim();

  if (!Number.isFinite(carats) || carats <= 0) return { error: 'Carats must be greater than zero.' };

  try {
    if (action === 'return') {
      await returnFromMemo({ memoLineId, carats, on });
    } else if (action === 'bill') {
      if (!invoiceNo) return { error: 'Invoice number is required to bill.' };
      await billMemoLine({
        memoLineId, carats, on, invoiceNo,
        rate: rateRaw ? Number(rateRaw) : undefined,
      });
    } else {
      return { error: 'Unknown action.' };
    }
  } catch (e) {
    return { error: toMessage(e) };
  }
  revalidateAll();
  return {
    ok: action === 'return' ? `${carats} ct returned.` : `${carats} ct billed on ${invoiceNo}.`,
  };
}
