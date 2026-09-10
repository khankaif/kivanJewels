/**
 * Money out of stock: a firm sale off a lot, and payments against a party.
 */
import { SettlementError, type Ctx, q, inCtx, round2, insertMovement } from './core';

export async function recordDirectSale(
  a: {
    lotId: string; carats: number; rate: number; on: string;
    invoiceNo: string; partyId: string;
    requirementLineId?: string | null; notes?: string;
  },
  ctx?: Ctx,
): Promise<string> {
  if (!a.invoiceNo.trim()) throw new SettlementError('an invoice number is required');
  if (!(a.carats > 0)) throw new SettlementError('carats must be greater than zero');
  if (!(a.rate >= 0)) throw new SettlementError('rate must not be negative');

  const amount = round2(a.carats * a.rate);
  const refType = a.requirementLineId ? 'requirement_line' : 'sale';
  const refId = a.requirementLineId ?? a.invoiceNo;

  return inCtx(ctx, async (c) => {
    await insertMovement('sale', {
      lotId: a.lotId, carats: a.carats, rate: a.rate, on: a.on,
      refType, ref: refId, notes: a.notes ?? `sold on ${a.invoiceNo}`,
    }, c);
    const [row] = await q(c)(
      `INSERT INTO ledger (party_id, kind, amount, dated_on, bill_no, ref_type, ref_id, notes)
       VALUES ($1,'sale_invoice',$2,$3,$4,$5,$6,$7) RETURNING id`,
      [a.partyId, amount, a.on, a.invoiceNo, refType, refId, a.notes ?? null],
    );
    return row.id as string;
  });
}

/**
 * A bill with no goods behind it: brokerage, freight, certification, labour --
 * and catch-up bills entered for the balance alone.
 *
 * No movement is written, deliberately. A bill for stock goes through
 * `recordPurchase` or `recordDirectSale` so the carats and the money move
 * together; this one is for the money that has no carats.
 */
export async function recordBill(
  a: {
    partyId: string; direction: 'sale' | 'purchase'; amount: number; on: string;
    billNo: string; notes?: string | null;
  },
  ctx?: Ctx,
): Promise<string> {
  if (!a.billNo.trim()) throw new SettlementError('a bill number is required');
  if (!(a.amount > 0)) throw new SettlementError('bill amount must be greater than zero');
  const amount = round2(a.amount);

  return inCtx(ctx, async (c) => {
    const [row] = await q(c)(
      `INSERT INTO ledger (party_id, kind, amount, dated_on, bill_no, ref_type, ref_id, notes)
       VALUES ($1,$2,$3,$4,$5,'bill',$5,$6) RETURNING id`,
      [a.partyId,
       a.direction === 'sale' ? 'sale_invoice' : 'purchase_invoice',
       // Positive = they owe us, negative = we owe them; the ledger_sign
       // constraint rejects anything else.
       a.direction === 'sale' ? amount : -amount,
       a.on, a.billNo.trim(), a.notes ?? null],
    );
    return row.id as string;
  });
}

export type PaymentMode = 'bank' | 'cash' | 'upi' | 'cheque' | 'adjustment' | 'other';

/**
 * Records a payment against a party.
 *
 * `billNo` allocates it to a specific bill so the bills view nets it off that
 * document. Without it the payment sits on account against the party balance,
 * which is what an unallocated advance or a lump-sum settlement really is.
 *
 * Direction is from your side: 'out' = money you paid, 'in' = money received.
 */
export async function recordPayment(
  a: {
    partyId: string; direction: 'in' | 'out'; amount: number; on: string;
    billNo?: string | null; refType?: string | null; refId?: string | null;
    mode?: PaymentMode; notes?: string | null;
  },
  ctx?: Ctx,
): Promise<string> {
  if (!(a.amount > 0)) throw new SettlementError('payment amount must be greater than zero');
  const amount = round2(a.amount);

  return inCtx(ctx, async (c) => {
    const run = q(c);

    // Guard the common fat-finger: paying more than a bill owes. An unallocated
    // on-account payment is always allowed, because advances are real.
    if (a.billNo) {
      const rows = await run(
        `SELECT balance FROM bills
         WHERE party_id = $1 AND bill_no = $2
           AND direction = $3`,
        [a.partyId, a.billNo, a.direction === 'in' ? 'sale' : 'purchase'],
      );
      if (rows.length) {
        const balance = Number(rows[0].balance);
        if (amount - balance > 0.005) {
          throw new SettlementError(
            `Payment of ${amount.toFixed(2)} exceeds the ${balance.toFixed(2)} outstanding on ` +
            `bill ${a.billNo}. Record the excess as an on-account payment instead.`,
          );
        }
      }
    }

    const [row] = await run(
      `INSERT INTO ledger (party_id, kind, amount, dated_on, bill_no, ref_type, ref_id, mode, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [a.partyId,
       a.direction === 'in' ? 'payment_in' : 'payment_out',
       a.direction === 'in' ? -amount : amount,
       a.on, a.billNo ?? null, a.refType ?? 'payment', a.refId ?? null,
       a.mode ?? null, a.notes ?? null],
    );
    return row.id as string;
  });
}
