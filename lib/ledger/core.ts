/**
 * Ledger core: the transaction plumbing and the one function that writes a
 * movement row. Everything else in lib/ledger builds on this.
 */
import { sql, withTx, type PoolClientLike } from '@/db/client';

export class OverdrawError extends Error {}
export class SettlementError extends Error {}

/**
 * Every function here takes an optional transaction context.
 *  - Omit it and the function opens its own transaction (normal app use).
 *  - Pass one and the work joins your transaction, so callers can compose
 *    several operations atomically -- and tests can run everything inside a
 *    transaction they roll back. That matters because `movements` is
 *    append-only: the trigger blocks DELETE, so rollback is the ONLY way to
 *    undo test fixtures.
 */
export type Ctx = PoolClientLike | undefined;

type Query = (text: string, values?: unknown[]) => Promise<any[]>;

export const q = (ctx: Ctx): Query =>
  ctx
    ? async (text, values) => (await ctx.query(text, values)).rows
    : async (text, values) => (await (sql as any).query(text, values)) as any[];

/** Runs fn in the given context, or opens a transaction when there is none. */
export const inCtx = <T>(ctx: Ctx, fn: (c: PoolClientLike) => Promise<T>): Promise<T> =>
  ctx ? fn(ctx) : withTx(fn);

export const round2 = (n: number) => Math.round(n * 100) / 100;
/** Matches the numeric(10,3) scale used for carats throughout the schema. */
export const EPS = 0.0005;

// ---------------------------------------------------------------- primitives
// q / inCtx / round2 / EPS are exported for the sibling ledger modules only.
// Callers outside lib/ledger should import from ./movements, the public barrel.

export async function lotBalance(lotId: string, ctx?: Ctx): Promise<number> {
  const rows = await q(ctx)('SELECT balance FROM lot_balances WHERE lot_id = $1', [lotId]);
  return rows.length ? Number(rows[0].balance) : 0;
}

export async function lotExposure(lotId: string, ctx?: Ctx): Promise<number> {
  const rows = await q(ctx)('SELECT exposure FROM lot_balances WHERE lot_id = $1', [lotId]);
  return rows.length ? Number(rows[0].exposure) : 0;
}

export type Entry = {
  lotId: string;
  carats: number; // always positive; the sign is applied from the kind
  rate?: number | null;
  on: string; // ISO date
  ref?: string;
  refType?: string;
  memoLineId?: string;
  notes?: string;
};

export const IN_KINDS = ['purchase', 'memo_in_receipt', 'memo_out_return', 'adjust_in'] as const;
export const OUT_KINDS = ['sale', 'memo_out_issue', 'memo_in_return', 'consumed_jewellery', 'adjust_out'] as const;
export type MovementKind = (typeof IN_KINDS)[number] | (typeof OUT_KINDS)[number];

export async function insertMovement(kind: MovementKind, e: Entry, ctx?: Ctx): Promise<string> {
  const sign = (IN_KINDS as readonly string[]).includes(kind) ? 1 : -1;
  const magnitude = Math.abs(e.carats);
  const rate = e.rate ?? null;
  try {
    const rows = await q(ctx)(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, memo_line_id,
                              ref_type, ref_id, moved_on, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [e.lotId, kind, sign * magnitude, rate,
       rate === null ? null : round2(magnitude * Number(rate)),
       e.memoLineId ?? null, e.refType ?? null, e.ref ?? null, e.on, e.notes ?? null],
    );
    return rows[0].id as string;
  } catch (err: any) {
    if (/insufficient stock/.test(err?.message ?? '')) throw new OverdrawError(err.message);
    throw err;
  }
}
