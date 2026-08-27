'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import { recordPayment, SettlementError, type PaymentMode } from '@/lib/ledger/movements';

export type PaymentState = { error: string } | { ok: string } | null;

const MODES = new Set(['bank', 'cash', 'upi', 'cheque', 'adjustment', 'other']);

export async function recordPaymentAction(_prev: PaymentState, form: FormData): Promise<PaymentState> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return { error: 'Not authenticated.' };

  const partyId = String(form.get('partyId') ?? '');
  const direction = String(form.get('direction') ?? '');
  const amount = Number(form.get('amount'));
  const on = String(form.get('on') ?? '');
  const billNo = String(form.get('billNo') ?? '').trim() || null;
  const mode = String(form.get('mode') ?? '').trim();
  const notes = String(form.get('notes') ?? '').trim() || null;

  if (!partyId) return { error: 'Select a party.' };
  if (direction !== 'in' && direction !== 'out') return { error: 'Choose received or paid.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount greater than zero.' };
  if (!on) return { error: 'Enter the payment date.' };
  if (mode && !MODES.has(mode)) return { error: 'Unknown payment mode.' };

  try {
    await recordPayment({
      partyId, direction, amount, on, billNo,
      mode: (mode || undefined) as PaymentMode | undefined,
      notes,
    });
  } catch (e) {
    if (e instanceof SettlementError) return { error: e.message };
    throw e;
  }

  for (const p of ['/', '/accounts', '/bills', '/ledger', '/parties']) revalidatePath(p);
  revalidatePath(`/parties/${partyId}`);
  return {
    ok: `${direction === 'in' ? 'Received' : 'Paid'} ₹${amount.toLocaleString('en-IN')}` +
        `${billNo ? ` against ${billNo}` : ' on account'}.`,
  };
}
