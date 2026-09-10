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
async function addToUnit(
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

// ------------------------------------------------------------ memo lifecycle
//
// Inward and outward memos are mirror images and share one settlement path:
//
//                    INWARD (supplier -> you)      OUTWARD (you -> client)
//   receive / issue  memo_in_receipt   +carats     memo_out_issue   -carats
//   return           memo_in_return    -carats     memo_out_return  +carats
//   bill             purchase_invoice, no movement sale_invoice, no movement
//
// Billing never moves carats in either direction: inward goods are already in
// the vault, outward goods already left it. Posting a movement at billing time
// would double-count. A line settles across ANY number of partial returns and
// billings until nothing is outstanding.

export type MemoDirection = 'in' | 'out';
export type MemoLineInput = { lotId: string; carats: number; rate: number };
/** Inward lines describe goods arriving, so they carry the parcel's attributes. */
export type InwardLineInput = {
  carats: number; rate: number; stoneType: string;
  shape?: string | null; sieveSize?: string | null; mmSize?: string | null;
  clarity?: string | null; colour?: string | null;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function partyTerms(partyId: string, c: PoolClientLike): Promise<number> {
  const rows = await q(c)('SELECT default_terms_days FROM parties WHERE id = $1', [partyId]);
  return rows.length ? Number(rows[0].default_terms_days) : 7;
}

/**
 * Receives goods from a supplier on memo (jangad in).
 *
 * The goods are NOT purchased yet -- no payable is created. Each line creates a
 * new lot (a parcel arriving is a new parcel) marked source='memo_in', and a
 * positive movement so the carats are immediately available to issue onward.
 * That matters for this business: a parcel routinely arrives on a supplier memo
 * and goes straight out on a client memo before it is ever bought.
 */
export async function receiveInwardMemo(
  a: {
    memoNo: string; partyId: string; issuedOn: string; dueOn?: string | null;
    termsDays?: number | null; agent?: string | null; notes?: string;
    requirementLineId?: string | null;
    lines: InwardLineInput[];
  },
  ctx?: Ctx,
): Promise<string> {
  if (!a.memoNo.trim()) throw new SettlementError('a memo number is required');
  if (!a.lines.length) throw new SettlementError('a memo needs at least one line');
  for (const l of a.lines) {
    if (!(l.carats > 0)) throw new SettlementError('every line needs carats greater than zero');
    if (!(l.rate >= 0)) throw new SettlementError('every line needs a valid rate');
  }

  return inCtx(ctx, async (c) => {
    const run = q(c);
    const terms = a.termsDays ?? (await partyTerms(a.partyId, c));
    const dueOn = a.dueOn ?? addDays(a.issuedOn, terms);

    const [memo] = await run(
      `INSERT INTO memos (memo_no, direction, party_id, issued_on, due_on, agent, terms_days, notes)
       VALUES ($1,'in',$2,$3,$4,$5,$6,$7) RETURNING id`,
      [a.memoNo, a.partyId, a.issuedOn, dueOn, a.agent ?? null, terms, a.notes ?? null],
    );

    let i = 0;
    for (const l of a.lines) {
      i += 1;
      const [lot] = await run(
        `INSERT INTO lots (lot_no, party_id, stone_type, shape, sieve_size, mm_size,
                           clarity, colour, cost_rate, source, opened_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'memo_in',$10) RETURNING id`,
        [`${a.memoNo}/${i}`, a.partyId, l.stoneType, l.shape ?? null, l.sieveSize ?? null,
         l.mmSize ?? null, l.clarity ?? null, l.colour ?? null, l.rate, a.issuedOn],
      );
      const [line] = await run(
        `INSERT INTO memo_lines (memo_id, lot_id, carats, rate, requirement_line_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [memo.id, lot.id, l.carats, l.rate, a.requirementLineId ?? null],
      );
      await insertMovement(
        'memo_in_receipt',
        { lotId: lot.id, carats: l.carats, rate: l.rate, on: a.issuedOn, memoLineId: line.id },
        c,
      );
    }
    return memo.id as string;
  });
}

/**
 * Issues an outward (jangad) memo to a client.
 *
 * Carats LEAVE the vault at issue -- the goods are physically with the client.
 * The database trigger refuses the whole transaction if any line overdraws its
 * lot, so a partly-written memo can never survive. Lots still held on a supplier
 * memo can be issued onward; that is the normal back-to-back case.
 */
export async function issueOutwardMemo(
  a: {
    memoNo: string; partyId: string; issuedOn: string; dueOn: string | null;
    agent?: string | null; notes?: string;
    requirementLineId?: string | null; lines: MemoLineInput[];
  },
  ctx?: Ctx,
): Promise<string> {
  if (!a.memoNo.trim()) throw new SettlementError('a memo number is required');
  if (!a.lines.length) throw new SettlementError('a memo needs at least one line');

  return inCtx(ctx, async (c) => {
    const run = q(c);
    const [memo] = await run(
      `INSERT INTO memos (memo_no, direction, party_id, issued_on, due_on, agent, notes)
       VALUES ($1,'out',$2,$3,$4,$5,$6) RETURNING id`,
      [a.memoNo, a.partyId, a.issuedOn, a.dueOn, a.agent ?? null, a.notes ?? null],
    );
    for (const l of a.lines) {
      const [line] = await run(
        `INSERT INTO memo_lines (memo_id, lot_id, carats, rate, requirement_line_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [memo.id, l.lotId, l.carats, l.rate, a.requirementLineId ?? null],
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

type LineState = {
  lineId: string; direction: MemoDirection; lotId: string; partyId: string;
  rate: number; carats: number; outstanding: number;
};

async function lineState(memoLineId: string, ctx: Ctx): Promise<LineState> {
  const rows = await q(ctx)(
    `SELECT line_id, direction, lot_id, party_id, rate, carats, outstanding
     FROM memo_line_status WHERE line_id = $1`,
    [memoLineId],
  );
  if (!rows.length) throw new SettlementError(`memo line ${memoLineId} not found`);
  const r = rows[0];
  return {
    lineId: r.line_id, direction: r.direction, lotId: r.lot_id, partyId: r.party_id,
    rate: Number(r.rate), carats: Number(r.carats), outstanding: Number(r.outstanding),
  };
}

/** Carats on this line neither returned nor billed yet. Works both directions. */
export async function memoLineOutstanding(memoLineId: string, ctx?: Ctx): Promise<number> {
  return (await lineState(memoLineId, ctx)).outstanding;
}

async function closeIfSettled(c: PoolClientLike, memoLineId: string) {
  const run = q(c);
  if ((await lineState(memoLineId, c)).outstanding > EPS) return;
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

function assertWithin(state: LineState, carats: number, verb: string) {
  if (!(carats > 0)) throw new SettlementError(`${verb} quantity must be greater than zero`);
  if (carats - state.outstanding > EPS) {
    throw new SettlementError(
      `${verb} of ${carats} ct exceeds outstanding ${state.outstanding} ct on this memo line`,
    );
  }
}

/**
 * Returns carats against a memo line, in whichever direction the memo runs:
 * an outward memo return brings goods back INTO the vault, an inward memo
 * return sends them back OUT to the vendor.
 *
 * The inward case is also constrained by the vault: goods already sold or
 * issued onward cannot be returned to the vendor, and the overdraw trigger
 * enforces that independently of this check.
 */
export async function returnFromMemo(
  a: { memoLineId: string; carats: number; on: string; notes?: string },
  ctx?: Ctx,
): Promise<void> {
  await inCtx(ctx, async (c) => {
    const st = await lineState(a.memoLineId, c);
    assertWithin(st, a.carats, 'return');
    await insertMovement(
      st.direction === 'out' ? 'memo_out_return' : 'memo_in_return',
      {
        lotId: st.lotId, carats: a.carats, rate: st.rate, on: a.on,
        memoLineId: a.memoLineId, notes: a.notes,
      },
      c,
    );
    await closeIfSettled(c, a.memoLineId);
  });
}

/**
 * Bills carats against a memo line.
 *
 * Outward: the client keeps the goods -> a receivable (sale_invoice).
 * Inward:  the vendor invoices you    -> a payable  (purchase_invoice), and the
 *          carats still in the vault move into the owned unit for their spec.
 *
 * Billing moves no carats in or out of the business -- inward goods are already
 * here, outward goods already left. The inward transfer is a change of
 * ownership between two lots, not a change of holding. Repeatable until settled.
 */
export async function billMemoLine(
  a: {
    memoLineId: string; carats: number; on: string; invoiceNo: string;
    rate?: number; dueOn?: string | null;
  },
  ctx?: Ctx,
): Promise<void> {
  if (!a.invoiceNo.trim()) throw new SettlementError('an invoice number is required');
  await inCtx(ctx, async (c) => {
    const run = q(c);
    const st = await lineState(a.memoLineId, c);
    assertWithin(st, a.carats, 'billing');

    const rate = a.rate ?? st.rate;
    if (!(rate >= 0)) throw new SettlementError('billing rate must not be negative');
    const amount = round2(a.carats * rate);

    await run(
      `INSERT INTO memo_line_billings (memo_line_id, carats, amount, rate, invoice_no, billed_on, due_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.memoLineId, a.carats, amount, rate, a.invoiceNo, a.on, a.dueOn ?? null],
    );

    if (st.direction === 'out') {
      await run(
        `INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
         VALUES ($1,'sale_invoice',$2,$3,'memo_line',$4)`,
        [st.partyId, amount, a.on, a.invoiceNo],
      );
    } else {
      await run(
        `INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
         VALUES ($1,'purchase_invoice',$2,$3,'memo_line',$4)`,
        [st.partyId, -amount, a.on, a.invoiceNo],
      );
      // Consignment goods become owned stock once the vendor has invoiced them,
      // and owned stock lives in the spec's unit -- not in the memo parcel,
      // which stays the supplier's document. Only what is still in the vault
      // moves: carats already sold or issued onward are gone, and you cannot
      // come to own what you no longer hold. That is the back-to-back case.
      const held = Math.min(a.carats, await lotBalance(st.lotId, c));
      if (held > EPS) {
        const [spec] = await run(
          `SELECT stone_type, shape, sieve_size, mm_size, clarity, colour
           FROM lots WHERE id = $1`,
          [st.lotId],
        );
        await insertMovement('adjust_out', {
          lotId: st.lotId, carats: held, rate, on: a.on,
          refType: 'bill', ref: a.invoiceNo, notes: `bought on ${a.invoiceNo}`,
        }, c);
        const unitId = await unitLot({
          stoneType: spec.stone_type, shape: spec.shape, sieveSize: spec.sieve_size,
          mmSize: spec.mm_size, clarity: spec.clarity, colour: spec.colour,
        }, c);
        await addToUnit({
          lotId: unitId, kind: 'adjust_in', carats: held, rate, on: a.on,
          refType: 'bill', ref: a.invoiceNo, notes: `bought on ${a.invoiceNo}`,
        }, c);
      }
    }
    await closeIfSettled(c, a.memoLineId);
  });
}

/**
 * Sells stock straight off a lot on a bill -- no memo step.
 *
 * Carats leave the vault (the overdraw guard enforces the balance) and a
 * receivable is posted. Firm: there is no sale-return movement kind, so if the
 * customer might send goods back, issue an outward memo instead.
 *
 * `requirementLineId` tags both the movement and the ledger row so the sale
 * counts against a customer requirement.
 */
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
