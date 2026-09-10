'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import {
  OverdrawError, recordBill, recordDirectSale, recordPayment, recordPurchase,
  SettlementError, type PaymentMode,
} from '@/lib/ledger/movements';

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

  for (const p of ['/', '/accounts', '/accounts/bills', '/parties']) revalidatePath(p);
  revalidatePath(`/parties/${partyId}`);
  return {
    ok: `${direction === 'in' ? 'Received' : 'Paid'} ₹${amount.toLocaleString('en-IN')}` +
        `${billNo ? ` against ${billNo}` : ' on account'}.`,
  };
}

export type BillState = { error: string } | { ok: string } | null;

const BILL_PATHS = ['/', '/accounts', '/accounts/bills', '/stock', '/sales', '/parties'];

/**
 * Records a bill three ways, because a bill means three different things:
 * a firm sale off stock, diamonds bought in, or charges with no diamonds at
 * all. The first two move carats and money together; the third only money.
 */
export async function addBillAction(_prev: BillState, form: FormData): Promise<BillState> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return { error: 'Not authenticated.' };

  const s = (k: string) => String(form.get(k) ?? '').trim();
  const partyId = s('partyId');
  const direction = s('direction');
  const withGoods = s('goods') === 'stock';
  const billNo = s('billNo');
  const on = s('on');
  const notes = s('notes') || null;

  if (!partyId) return { error: 'Select the party.' };
  if (direction !== 'sale' && direction !== 'purchase') return { error: 'Choose sale or purchase.' };
  if (!billNo) return { error: 'Enter the bill number.' };
  if (!on) return { error: 'Enter the bill date.' };

  const carats = Number(form.get('carats'));
  const rate = Number(form.get('rate'));
  if (withGoods) {
    if (!Number.isFinite(carats) || carats <= 0) return { error: 'Enter carats greater than zero.' };
    if (!Number.isFinite(rate) || rate < 0) return { error: 'Enter a valid rate.' };
  }

  try {
    if (withGoods && direction === 'sale') {
      const lotId = s('lotId');
      if (!lotId) return { error: 'Pick the stock this sale comes out of.' };
      await recordDirectSale({ lotId, carats, rate, on, invoiceNo: billNo, partyId, notes: notes ?? undefined });
    } else if (withGoods) {
      if (!s('sieveSize') && !s('mmSize')) return { error: 'Enter a sieve or an MM size.' };
      await recordPurchase({
        spec: {
          stoneType: s('stoneType') || 'Lab Grown',
          shape: s('shape') || null, sieveSize: s('sieveSize') || null, mmSize: s('mmSize') || null,
          colour: s('colour') || null, clarity: s('clarity') || null,
        },
        carats, rate, on, partyId, billNo,
      });
    } else {
      const amount = Number(form.get('amount'));
      if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount greater than zero.' };
      await recordBill({ partyId, direction, amount, on, billNo, notes });
    }
  } catch (e) {
    if (e instanceof OverdrawError) return { error: 'That lot does not hold enough carats.' };
    if (e instanceof SettlementError) return { error: e.message };
    if (e instanceof Error && /duplicate key/.test(e.message)) return { error: 'That bill number is already used.' };
    throw e;
  }

  for (const p of BILL_PATHS) revalidatePath(p);
  revalidatePath(`/parties/${partyId}`);
  return { ok: `Bill ${billNo} recorded.` };
}
