'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import { withTx } from '@/db/client';
import {
  OverdrawError, recordBill, recordDirectSale, recordPayment, recordPurchase,
  SettlementError, type PaymentMode,
} from '@/lib/ledger/movements';
import { checkSpec, type StoredSpec } from '@/features/masters/diamonds/spec';
import { docNoOr } from '@/lib/doc-numbers';

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

/** One line of a bill. Which fields matter depends on what the bill is for. */
type BillLineInput = {
  lotId?: string;                       // sale off stock
  spec?: Record<string, string>;        // purchase into stock
  carats?: number; rate?: number;
  amount?: number;                      // charges, no diamonds
  notes?: string;
};

/**
 * Records a bill three ways, because a bill means three different things:
 * a firm sale off stock, diamonds bought in, or charges with no diamonds at
 * all. The first two move carats and money together; the third only money.
 *
 * All the lines of one bill go in a single transaction: a two-line invoice
 * that half-posted would leave a document whose total is a lie.
 */
export async function addBillAction(_prev: BillState, form: FormData): Promise<BillState> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return { error: 'Not authenticated.' };

  const s = (k: string) => String(form.get(k) ?? '').trim();
  const partyId = s('partyId');
  const direction = s('direction');
  const withGoods = s('goods') === 'stock';
  let billNo = s('billNo');
  const on = s('on');
  const dueOn = s('dueOn') || null;
  const notes = s('notes') || null;

  if (!partyId) return { error: 'Select the party.' };
  if (direction !== 'sale' && direction !== 'purchase') return { error: 'Choose sale or purchase.' };
  // Ours to issue on a sale; theirs to quote on a purchase.
  if (!billNo && direction === 'purchase') return { error: "Enter the supplier's bill number." };
  if (!on) return { error: 'Enter the bill date.' };
  if (dueOn && dueOn < on) return { error: 'The due date cannot fall before the bill date.' };

  let lines: BillLineInput[];
  try {
    lines = JSON.parse(String(form.get('lines') ?? '[]'));
  } catch {
    return { error: 'Could not read the bill lines.' };
  }
  if (!lines.length) return { error: 'Add at least one line.' };

  // Validate every line before writing any of them, so a bad third line does
  // not roll back two good ones after the fact.
  const prepared: { line: BillLineInput; spec?: StoredSpec }[] = [];
  for (const [i, line] of lines.entries()) {
    const at = lines.length > 1 ? ` on line ${i + 1}` : '';
    if (withGoods) {
      if (!Number.isFinite(line.carats) || (line.carats ?? 0) <= 0) {
        return { error: `Enter carats greater than zero${at}.` };
      }
      if (!Number.isFinite(line.rate) || (line.rate ?? 0) < 0) return { error: `Enter a valid rate${at}.` };
      if (direction === 'sale') {
        if (!line.lotId) return { error: `Pick the stock this sale comes out of${at}.` };
        prepared.push({ line });
      } else {
        const checked = await checkSpec(line.spec ?? {});
        if (!checked.ok) return { error: `${checked.error.replace(/\.$/, '')}${at}.` };
        prepared.push({ line, spec: checked.spec });
      }
    } else {
      if (!Number.isFinite(line.amount) || (line.amount ?? 0) <= 0) {
        return { error: `Enter an amount greater than zero${at}.` };
      }
      prepared.push({ line });
    }
  }

  try {
    await withTx(async (tx) => {
      // Our own sale invoice gets the next number in the series when the field
      // was left blank; a purchase carries the supplier's number, never ours.
      if (direction === 'sale') billNo = await docNoOr(billNo, 'invoice', tx);
      for (const { line, spec } of prepared) {
        if (withGoods && direction === 'sale') {
          await recordDirectSale({
            lotId: line.lotId!, carats: line.carats!, rate: line.rate!, on,
            invoiceNo: billNo, partyId, dueOn, notes: line.notes ?? notes ?? undefined,
          }, tx);
        } else if (withGoods) {
          await recordPurchase({
            spec: spec!,
            carats: line.carats!, rate: line.rate!, on, partyId, billNo, dueOn,
            notes: line.notes ?? notes ?? undefined,
          }, tx);
        } else {
          await recordBill({
            partyId, direction, amount: line.amount!, on, billNo, dueOn,
            notes: line.notes ?? notes,
          }, tx);
        }
      }
    });
  } catch (e) {
    if (e instanceof OverdrawError) return { error: 'That lot does not hold enough carats.' };
    if (e instanceof SettlementError) return { error: e.message };
    if (e instanceof Error && /duplicate key/.test(e.message)) return { error: 'That bill number is already used.' };
    throw e;
  }

  for (const p of BILL_PATHS) revalidatePath(p);
  revalidatePath(`/parties/${partyId}`);
  return {
    ok: `Bill ${billNo} recorded${lines.length > 1 ? ` — ${lines.length} lines` : ''}.`,
  };
}
