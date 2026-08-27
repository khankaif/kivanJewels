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

const q = (ctx: Ctx): Query =>
  ctx
    ? async (text, values) => (await ctx.query(text, values)).rows
    : async (text, values) => (await (sql as any).query(text, values)) as any[];

/** Runs fn in the given context, or opens a transaction when there is none. */
const inCtx = <T>(ctx: Ctx, fn: (c: PoolClientLike) => Promise<T>): Promise<T> =>
  ctx ? fn(ctx) : withTx(fn);

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Matches the numeric(10,3) scale used for carats throughout the schema. */
const EPS = 0.0005;

// ---------------------------------------------------------------- primitives

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

const IN_KINDS = ['purchase', 'memo_in_receipt', 'memo_out_return', 'adjust_in'] as const;
const OUT_KINDS = ['sale', 'memo_out_issue', 'memo_in_return', 'consumed_jewellery', 'adjust_out'] as const;
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

export const recordPurchase = (e: Entry, ctx?: Ctx) => insertMovement('purchase', e, ctx);
export const recordSale = (e: Entry, ctx?: Ctx) => insertMovement('sale', e, ctx);
export const recordMemoInReceipt = (e: Entry, ctx?: Ctx) => insertMovement('memo_in_receipt', e, ctx);
export const recordMemoInReturn = (e: Entry, ctx?: Ctx) => insertMovement('memo_in_return', e, ctx);
export const recordConsumedForJewellery = (e: Entry, ctx?: Ctx) =>
  insertMovement('consumed_jewellery', e, ctx);

// ------------------------------------------------------------ memo lifecycle

export type MemoLineInput = { lotId: string; carats: number; rate: number };

/**
 * Issues an outward (jangad) memo. Carats LEAVE the vault at issue -- the goods
 * are physically with the client -- so each line writes a negative
 * `memo_out_issue` movement. The database trigger refuses the whole
 * transaction if any line overdraws its lot, so a partly-written memo can
 * never survive.
 */
export async function issueOutwardMemo(
  a: {
    memoNo: string; partyId: string; issuedOn: string;
    dueOn: string | null; lines: MemoLineInput[]; notes?: string;
  },
  ctx?: Ctx,
): Promise<string> {
  if (!a.lines.length) throw new SettlementError('a memo needs at least one line');

  return inCtx(ctx, async (c) => {
    const run = q(c);
    const [memo] = await run(
      `INSERT INTO memos (memo_no, direction, party_id, issued_on, due_on, notes)
       VALUES ($1,'out',$2,$3,$4,$5) RETURNING id`,
      [a.memoNo, a.partyId, a.issuedOn, a.dueOn, a.notes ?? null],
    );
    for (const l of a.lines) {
      const [line] = await run(
        `INSERT INTO memo_lines (memo_id, lot_id, carats, rate)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [memo.id, l.lotId, l.carats, l.rate],
      );
      await insertMovement(
        'memo_out_issue',
        { lotId: l.lotId, carats: l.carats, rate: l.rate, on: a.issuedOn, memoLineId: line.id },
        c,
      );
    }
    return memo.id as string;
  });
}

/** Carats on this line neither returned nor billed yet. */
export async function memoLineOutstanding(memoLineId: string, ctx?: Ctx): Promise<number> {
  const rows = await q(ctx)(
    `SELECT ml.carats
            - COALESCE((SELECT SUM(ABS(m.carats)) FROM movements m
                        WHERE m.memo_line_id = ml.id AND m.kind = 'memo_out_return'), 0)
            - COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
                        WHERE b.memo_line_id = ml.id), 0) AS outstanding
     FROM memo_lines ml WHERE ml.id = $1`,
    [memoLineId],
  );
  if (!rows.length) throw new SettlementError(`memo line ${memoLineId} not found`);
  return Number(rows[0].outstanding);
}

async function closeIfSettled(c: PoolClientLike, memoLineId: string) {
  const run = q(c);
  const remaining = await memoLineOutstanding(memoLineId, c);
  if (remaining > EPS) return;
  await run(`UPDATE memo_lines SET status = 'settled' WHERE id = $1`, [memoLineId]);
  await run(
    `UPDATE memos SET status = 'closed'
     WHERE id = (SELECT memo_id FROM memo_lines WHERE id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM memo_lines
         WHERE memo_id = (SELECT memo_id FROM memo_lines WHERE id = $1) AND status = 'open')`,
    [memoLineId],
  );
}

async function assertWithinOutstanding(memoLineId: string, carats: number, verb: string, c: PoolClientLike) {
  if (carats <= 0) throw new SettlementError(`${verb} quantity must be positive`);
  const outstanding = await memoLineOutstanding(memoLineId, c);
  if (carats - outstanding > EPS) {
    throw new SettlementError(
      `${verb} of ${carats} ct exceeds outstanding ${outstanding} ct on this memo line`,
    );
  }
}

/** Client hands goods back. Carats re-enter the vault. Repeatable. */
export async function returnFromMemo(
  a: { memoLineId: string; carats: number; on: string; notes?: string },
  ctx?: Ctx,
): Promise<void> {
  await inCtx(ctx, async (c) => {
    await assertWithinOutstanding(a.memoLineId, a.carats, 'return', c);
    const [ml] = await q(c)('SELECT lot_id, rate FROM memo_lines WHERE id = $1', [a.memoLineId]);
    await insertMovement(
      'memo_out_return',
      {
        lotId: ml.lot_id, carats: a.carats, rate: Number(ml.rate), on: a.on,
        memoLineId: a.memoLineId, notes: a.notes,
      },
      c,
    );
    await closeIfSettled(c, a.memoLineId);
  });
}

/**
 * Client keeps goods and is invoiced.
 *
 * Writes NO movement: the carats already left the vault at `memo_out_issue`.
 * Posting one here would double-count every sale. It records the billing and
 * posts a receivable to the money ledger. Repeatable, like returns.
 */
export async function billMemoLine(
  a: { memoLineId: string; carats: number; on: string; invoiceNo: string },
  ctx?: Ctx,
): Promise<void> {
  if (!a.invoiceNo.trim()) throw new SettlementError('an invoice number is required');
  await inCtx(ctx, async (c) => {
    const run = q(c);
    await assertWithinOutstanding(a.memoLineId, a.carats, 'billing', c);
    const [ml] = await run(
      `SELECT ml.rate, m.party_id FROM memo_lines ml
       JOIN memos m ON m.id = ml.memo_id WHERE ml.id = $1`,
      [a.memoLineId],
    );
    const amount = round2(a.carats * Number(ml.rate));
    await run(
      `INSERT INTO memo_line_billings (memo_line_id, carats, amount, invoice_no, billed_on)
       VALUES ($1,$2,$3,$4,$5)`,
      [a.memoLineId, a.carats, amount, a.invoiceNo, a.on],
    );
    await run(
      `INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
       VALUES ($1,'sale_invoice',$2,$3,'memo_line',$4)`,
      [ml.party_id, amount, a.on, a.invoiceNo],
    );
    await closeIfSettled(c, a.memoLineId);
  });
}
