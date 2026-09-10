/**
 * Owned stock: one lot per spec, and the purchases that feed it.
 */
import { type PoolClientLike } from '@/db/client';
import {
  SettlementError, type Ctx, type MovementKind,
  q, inCtx, round2, insertMovement, lotBalance,
} from './core';

// ------------------------------------------------------------- owned stock
//
// Owned stock is fungible by spec: one lot per shape/sieve/mm, so buying 2.20mm
// twice adds carats to the unit you already have instead of minting a second
// row. Memo stock is deliberately NOT consolidated -- that parcel goes back to
// that supplier, so it keeps its own lot. See db/migrations/014_stock_units.sql.

export type Spec = {
  stoneType: string;
  shape?: string | null; sieveSize?: string | null; mmSize?: string | null;
  clarity?: string | null; colour?: string | null;
};

/** The one owned lot for a spec, created on first purchase. */
export async function unitLot(spec: Spec, c: PoolClientLike): Promise<string> {
  const run = q(c);
  const key = [spec.shape ?? null, spec.sieveSize ?? null, spec.mmSize ?? null,
               spec.colour ?? null, spec.clarity ?? null];
  const find = () =>
    run(`SELECT id FROM lots WHERE source = 'unit' AND unit_key = lot_unit_key($1,$2,$3,$4,$5)`, key);

  const [found] = await find();
  if (found) return found.id as string;

  // ON CONFLICT rather than a plain insert: the partial unique index on
  // unit_key is what makes consolidation true, so losing the race must reuse
  // the winner's unit, not fail the purchase.
  const [made] = await run(
    `INSERT INTO lots (lot_no, stone_type, shape, sieve_size, mm_size, clarity, colour,
                       cost_rate, source, opened_on)
     VALUES ('U-' || nextval('lot_unit_seq'), $1,$2,$3,$4,$5,$6, 0, 'unit', CURRENT_DATE)
     ON CONFLICT (unit_key) WHERE source = 'unit' DO NOTHING
     RETURNING id`,
    [spec.stoneType, spec.shape ?? null, spec.sieveSize ?? null, spec.mmSize ?? null,
     spec.clarity ?? null, spec.colour ?? null],
  );
  if (made) return made.id as string;
  return (await find())[0].id as string;
}

/**
 * Moves carats into an owned unit and re-averages its cost.
 *
 * Cost is value / weight, carried forward: a unit holding 2 ct at 4500 that
 * takes 2 ct at 5000 is then 4 ct at 4750. Averaging over the lot's whole
 * purchase history instead would misprice a unit that was emptied and rebought.
 */
export async function addToUnit(
  a: { lotId: string; kind: MovementKind; carats: number; rate: number; on: string;
       ref?: string; refType?: string; notes?: string },
  c: PoolClientLike,
): Promise<void> {
  const held = Math.max(await lotBalance(a.lotId, c), 0);
  await insertMovement(a.kind, { ...a, rate: a.rate }, c);
  await q(c)(
    `UPDATE lots
     SET cost_rate = ($2::numeric * COALESCE(cost_rate,0) + $3::numeric * $4::numeric)
                     / ($2::numeric + $3::numeric)
     WHERE id = $1`,
    [a.lotId, held, a.carats, a.rate],
  );
}

/**
 * Buys stock outright: goods you own from the moment they arrive.
 *
 * `billNo` means the supplier invoiced you, so a payable is posted alongside
 * the carats. Without it the purchase is stock-only -- cash over the counter,
 * or an opening balance being entered.
 */
export async function recordPurchase(
  a: {
    spec: Spec; carats: number; rate: number; on: string;
    partyId?: string | null; billNo?: string | null; notes?: string;
  },
  ctx?: Ctx,
): Promise<string> {
  if (!(a.carats > 0)) throw new SettlementError('carats must be greater than zero');
  if (!(a.rate >= 0)) throw new SettlementError('rate must not be negative');
  if (a.billNo && !a.partyId) throw new SettlementError('a bill needs a supplier');

  return inCtx(ctx, async (c) => {
    const lotId = await unitLot(a.spec, c);
    await addToUnit(
      { lotId, kind: 'purchase', carats: a.carats, rate: a.rate, on: a.on,
        refType: a.billNo ? 'bill' : undefined, ref: a.billNo ?? undefined, notes: a.notes },
      c,
    );

    if (a.billNo) {
      await q(c)(
        `INSERT INTO ledger (party_id, kind, amount, dated_on, bill_no, ref_type, ref_id, notes)
         VALUES ($1,'purchase_invoice',$2,$3,$4,'purchase',$5,$6)`,
        [a.partyId, -round2(a.carats * a.rate), a.on, a.billNo, a.billNo, a.notes ?? null],
      );
    }
    return lotId;
  });
}
