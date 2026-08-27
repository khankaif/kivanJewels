'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import {
  receiveInwardMemo, issueOutwardMemo, returnFromMemo, billMemoLine,
  OverdrawError, SettlementError,
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

/** Goods arriving from a supplier on approval. Creates no payable. */
export async function receiveMemoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const memoNo = String(form.get('memoNo') ?? '').trim();
  const partyId = String(form.get('partyId') ?? '');
  const carats = Number(form.get('carats'));
  const rate = Number(form.get('rate'));
  const issuedOn = String(form.get('issuedOn') ?? '');
  const termsRaw = String(form.get('termsDays') ?? '').trim();

  if (!memoNo) return { error: 'Memo number is required.' };
  if (!partyId) return { error: 'Select a supplier.' };
  if (!Number.isFinite(carats) || carats <= 0) return { error: 'Carats must be greater than zero.' };
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Enter a valid rate.' };

  try {
    await receiveInwardMemo({
      memoNo, partyId, issuedOn,
      termsDays: termsRaw ? Number(termsRaw) : null,
      agent: String(form.get('agent') ?? '').trim() || null,
      lines: [{
        carats, rate,
        stoneType: String(form.get('stoneType') ?? '').trim() || 'Lab Grown',
        shape: String(form.get('shape') ?? '').trim() || null,
        sieveSize: String(form.get('sieveSize') ?? '').trim() || null,
        mmSize: String(form.get('mmSize') ?? '').trim() || null,
      }],
    });
  } catch (e) {
    return { error: toMessage(e) };
  }
  revalidateAll();
  return { ok: `Inward memo ${memoNo} received — ${carats} ct now in the vault, not yet purchased.` };
}

/** Goods going out to a client on approval. Carats leave the vault. */
export async function issueMemoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const memoNo = String(form.get('memoNo') ?? '').trim();
  const partyId = String(form.get('partyId') ?? '');
  const lotId = String(form.get('lotId') ?? '');
  const carats = Number(form.get('carats'));
  const rate = Number(form.get('rate'));
  const issuedOn = String(form.get('issuedOn') ?? '');
  const dueOn = String(form.get('dueOn') ?? '') || null;

  if (!memoNo) return { error: 'Memo number is required.' };
  if (!partyId) return { error: 'Select a client.' };
  if (!lotId) return { error: 'Select a lot.' };
  if (!Number.isFinite(carats) || carats <= 0) return { error: 'Carats must be greater than zero.' };
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Enter a valid rate.' };

  try {
    await issueOutwardMemo({
      memoNo, partyId, issuedOn, dueOn,
      agent: String(form.get('agent') ?? '').trim() || null,
      lines: [{ lotId, carats, rate }],
    });
  } catch (e) {
    return { error: toMessage(e) };
  }
  revalidateAll();
  return { ok: `Memo ${memoNo} issued.` };
}

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
