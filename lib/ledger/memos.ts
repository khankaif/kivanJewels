/**
 * Memo lifecycle: goods on approval in both directions, and their settlement.
 */
import { type PoolClientLike } from '@/db/client';
import {
  SettlementError, type Ctx,
  q, inCtx, round2, EPS, insertMovement, lotBalance,
} from './core';

import { unitLot, addToUnit } from './stock';

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
    rate?: number;
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
      `INSERT INTO memo_line_billings (memo_line_id, carats, amount, rate, invoice_no, billed_on)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.memoLineId, a.carats, amount, rate, a.invoiceNo, a.on],
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