'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import {
  issueOutwardMemo, returnFromMemo, billMemoLine,
  OverdrawError, SettlementError,
} from '@/lib/ledger/movements';

export type ActionState = { error: string } | { ok: string } | null;

async function requireUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
}

/** Turns domain errors into messages a user can act on; rethrows the rest. */
function toMessage(e: unknown): string {
  if (e instanceof OverdrawError) {
    const m = /balance ([\d.]+), requested ([\d.]+)/.exec(e.message);
    return m
      ? `Not enough stock: the lot holds ${m[1]} ct but ${m[2]} ct was requested.`
      : 'Not enough stock in that lot.';
  }
  if (e instanceof SettlementError) return e.message;
  if (e instanceof Error && /duplicate key/.test(e.message)) return 'That memo number is already used.';
  throw e;
}

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
    await issueOutwardMemo({ memoNo, partyId, issuedOn, dueOn, lines: [{ lotId, carats, rate }] });
  } catch (e) {
    return { error: toMessage(e) };
  }
  revalidatePath('/memos');
  revalidatePath('/stock');
  return { ok: `Memo ${memoNo} issued.` };
}

export async function settleLineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const memoLineId = String(form.get('memoLineId') ?? '');
  const action = String(form.get('action') ?? '');
  const carats = Number(form.get('carats'));
  const on = String(form.get('on') ?? '');
  const invoiceNo = String(form.get('invoiceNo') ?? '').trim();

  if (!Number.isFinite(carats) || carats <= 0) return { error: 'Carats must be greater than zero.' };

  try {
    if (action === 'return') {
      await returnFromMemo({ memoLineId, carats, on });
    } else if (action === 'bill') {
      if (!invoiceNo) return { error: 'Invoice number is required to bill.' };
      await billMemoLine({ memoLineId, carats, on, invoiceNo });
    } else {
      return { error: 'Unknown action.' };
    }
  } catch (e) {
    return { error: toMessage(e) };
  }
  revalidatePath('/memos');
  revalidatePath('/stock');
  revalidatePath('/accounts');
  return { ok: action === 'return' ? `${carats} ct returned to vault.` : `${carats} ct billed on ${invoiceNo}.` };
}
