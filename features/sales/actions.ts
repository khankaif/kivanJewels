'use server';

import { revalidatePath } from 'next/cache';
import { sql, withTx, type PoolClientLike } from '@/db/client';
import { auth } from '@/lib/auth/server';
import {
  issueOutwardMemo, receiveInwardMemo, recordDirectSale, recordPurchase,
  SettlementError, OverdrawError,
} from '@/lib/ledger/movements';
import { checkSpec, type StoredSpec } from '@/features/masters/diamonds/spec';
import { allocate } from './allocate';
import { docNoOr } from '@/lib/doc-numbers';

export type ActionState = { error: string } | { ok: string } | null;

async function requireUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
}

const PATHS = ['/', '/sales', '/stock', '/accounts/bills', '/accounts', '/parties'];
const revalidate = () => PATHS.forEach((p) => revalidatePath(p));

function toMessage(e: unknown): string | null {
  if (e instanceof OverdrawError) {
    const m = /balance ([\d.]+), requested ([\d.]+)/.exec(e.message);
    return m
      ? `Not enough stock: that lot holds ${m[1]} ct but ${m[2]} ct was asked for.`
      : 'Not enough stock in that lot.';
  }
  if (e instanceof SettlementError) return e.message;
  if (e instanceof Error && /duplicate key/.test(e.message)) return 'That number is already used.';
  return null;
}

type SaleLineInput = {
  /** Set when the operator picked a parcel off the shelf instead of typing a spec. */
  lotId?: string;
  stoneType?: string; shape?: string; sieveSize?: string; mmSize?: string;
  colour?: string; clarity?: string; lab?: string; certified?: string;
  carats: number; quotedRate?: number | null;
  planStock?: number | null; planSource?: number | null;
  costRate?: number | null;
};

/** The spec a chosen parcel already carries, so a sale off the shelf types nothing. */
async function specOfLotById(lotId: string) {
  const [row] = await sql`
    SELECT stone_type AS "stoneType", shape, sieve_size AS "sieveSize", mm_size AS "mmSize",
           colour, clarity, lab, certified
    FROM lots WHERE id = ${lotId}`;
  return (row ?? {}) as Record<string, string | null>;
}

/** Lots that can fill a spec now: owned stock first, then goods held on memo. */
async function lotsForSpec(c: PoolClientLike, unitKey: string) {
  const { rows } = await c.query(
    `SELECT b.lot_id, b.lot_no, b.balance, l.source
     FROM lot_balances b JOIN lots l ON l.id = b.lot_id
     WHERE l.unit_key = $1 AND b.balance > 0.0005
     ORDER BY (l.source = 'unit') DESC, b.balance DESC`,
    [unitKey],
  );
  return rows as { lot_id: string; lot_no: string; balance: number; source: string }[];
}

/**
 * Raises a customer requirement and, when asked, fills it in the same save.
 *
 * One screen, because the two halves were never separate decisions: you know
 * while writing the order which lines come off the shelf and which have to be
 * bought in. Each line carries that split (`plan_stock` / `plan_source`), and
 * "deliver now" turns it into real documents inside one transaction -- an
 * outward memo or invoice for the stock half, a supplier memo or purchase for
 * the sourced half.
 */
export async function createSaleAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const partyId = s('partyId');
  const raisedOn = s('raisedOn');
  const agent = s('agent') || null;
  const notes = s('notes') || null;
  const deliverNow = s('deliverNow') === '1';
  const channel = s('channel');
  const sourceNow = s('sourceNow') === '1';
  const supplierId = s('supplierId');
  const sourceChannel = s('sourceChannel');

  if (!partyId) return { error: 'Select the customer.' };
  if (!raisedOn) return { error: 'Enter a date.' };

  let lines: SaleLineInput[];
  try {
    lines = JSON.parse(String(form.get('lines') ?? '[]'));
  } catch {
    return { error: 'Could not read the line items.' };
  }
  lines = lines.filter((l) => Number(l.carats) > 0);
  if (!lines.length) return { error: 'Add at least one line with carats.' };

  // Validate every line against the masters rules before anything is written.
  const checked: { line: SaleLineInput; spec: StoredSpec }[] = [];
  for (const [i, l] of lines.entries()) {
    const at = lines.length > 1 ? ` on line ${i + 1}` : '';
    // A line off the shelf inherits the parcel's spec: it is already master
    // values, and retyping it is how two names for one stone get created.
    const input = l.lotId ? { ...l, ...(await specOfLotById(l.lotId)) } : l;
    const res = await checkSpec(input);
    if (!res.ok) return { error: `${res.error.replace(/\.$/, '')}${at}.` };
    const stock = Number(l.planStock ?? 0);
    const source = Number(l.planSource ?? 0);
    if (stock < 0 || source < 0) return { error: `A split cannot be negative${at}.` };
    if (stock + source - Number(l.carats) > 0.0005) {
      return { error: `The split adds up to more than the ${l.carats} ct asked for${at}.` };
    }
    checked.push({ line: l, spec: res.spec });
  }

  const deliverLines = checked.filter(({ line }) => Number(line.planStock ?? 0) > 0.0005);
  const sourceLines = checked.filter(({ line }) => Number(line.planSource ?? 0) > 0.0005);

  if (deliverNow) {
    if (channel !== 'memo' && channel !== 'bill') return { error: 'Pick memo or bill for the delivery.' };
    if (!deliverLines.length) return { error: 'No line is set to come out of stock.' };
    for (const { line } of deliverLines) {
      if (!(Number(line.quotedRate) >= 0)) {
        return { error: 'Every line you deliver needs a rate — that is what the customer is charged.' };
      }
    }
  }
  if (sourceNow) {
    if (!supplierId) return { error: 'Select the supplier you are sourcing from.' };
    if (sourceChannel !== 'memo' && sourceChannel !== 'bill') return { error: 'Pick memo or bill for the sourcing.' };
    if (!sourceLines.length) return { error: 'No line is set to be sourced.' };
    for (const { line } of sourceLines) {
      if (!(Number(line.costRate) >= 0)) {
        return { error: 'Every sourced line needs a cost rate — what the supplier charges you.' };
      }
    }
  }

  let requirementNo = '';
  let delivered = 0;
  let docNo = '';
  try {
    await withTx(async (c) => {
      const { rows: [r] } = await c.query(
        `INSERT INTO requirements (party_id, raised_on, agent, notes)
         VALUES ($1,$2,$3,$4) RETURNING id, requirement_no`,
        [partyId, raisedOn, agent, notes],
      );
      requirementNo = r.requirement_no;

      const ids: string[] = [];
      for (const { line, spec } of checked) {
        const { rows: [row] } = await c.query(
          `INSERT INTO requirement_lines
             (requirement_id, stone_type, shape, sieve_size, mm_size, colour, clarity,
              lab, certified, carats, quoted_rate, plan_stock, plan_source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [r.id, spec.stoneType, spec.shape, spec.sieveSize, spec.mmSize, spec.colour, spec.clarity,
           spec.lab, spec.certified,
           Number(line.carats), line.quotedRate ? Number(line.quotedRate) : null,
           line.planStock ?? null, line.planSource ?? null],
        );
        ids.push(row.id as string);
      }
      const lineId = (l: SaleLineInput) => ids[checked.findIndex((x) => x.line === l)];

      if (deliverNow) {
        // Allocate off the shelf oldest-cheapest-first is not the rule here:
        // owned stock goes before goods held on a supplier memo, because memo
        // goods still belong to the supplier. Lot-by-lot picking stays on the
        // requirement page for the cases that need it.
        const picks: { lotId: string; carats: number; rate: number; requirementLineId: string }[] = [];
        for (const { line, spec } of deliverLines) {
          const { rows: [k] } = await c.query(
            'SELECT lot_unit_key($1,$2,$3,$4,$5,$6,$7,$8) AS key',
            [spec.stoneType, spec.shape, spec.sieveSize, spec.mmSize, spec.colour, spec.clarity,
             spec.lab, spec.certified]);
          const want = Number(line.planStock);
          const lots = (await lotsForSpec(c, k.key))
            .map((l) => ({ lotId: l.lot_id, balance: Number(l.balance) }))
            // The parcel the operator actually picked goes first; the rest of
            // the same spec only fills what that one cannot.
            .sort((a, b) => Number(b.lotId === line.lotId) - Number(a.lotId === line.lotId));
          const { picks: taken, short } = allocate(lots, want);
          if (short > 0) {
            throw new SettlementError(
              `Only ${(want - short).toFixed(3)} ct of that spec is in stock — ` +
              `move the rest of the line to sourcing.`,
            );
          }
          for (const p of taken) {
            picks.push({ ...p, rate: Number(line.quotedRate ?? 0), requirementLineId: lineId(line) });
          }
        }
        delivered = picks.reduce((sum, p) => sum + p.carats, 0);

        if (channel === 'memo') {
          docNo = await docNoOr(s('memoNo'), 'memo_out', c);
          await issueOutwardMemo({
            memoNo: docNo, partyId, issuedOn: raisedOn, dueOn: s('dueOn') || null,
            agent, lines: picks,
          }, c);
        } else {
          docNo = await docNoOr(s('invoiceNo'), 'invoice', c);
          for (const p of picks) {
            await recordDirectSale({
              lotId: p.lotId, carats: p.carats, rate: p.rate, on: raisedOn,
              invoiceNo: docNo, partyId, dueOn: s('dueOn') || null,
              requirementLineId: p.requirementLineId,
            }, c);
          }
        }
      }

      if (sourceNow) {
        const inwardLines = sourceLines.map(({ line, spec }) => ({
          ...spec, carats: Number(line.planSource), rate: Number(line.costRate ?? 0),
          requirementLineId: lineId(line),
        }));
        if (sourceChannel === 'memo') {
          const termsRaw = s('termsDays');
          await receiveInwardMemo({
            memoNo: await docNoOr(s('sourceMemoNo'), 'memo_in', c), partyId: supplierId,
            issuedOn: raisedOn,
            termsDays: termsRaw ? Number(termsRaw) : null,
            lines: inwardLines,
          }, c);
        } else {
          for (const l of inwardLines) {
            await recordPurchase({
              spec: l, carats: l.carats, rate: l.rate, on: raisedOn,
              partyId: supplierId, billNo: s('billNo') || null,
            }, c);
          }
        }
      }
    });
  } catch (e) {
    return { error: toMessage(e) ?? (e instanceof Error ? e.message : 'Could not save.') };
  }
  revalidate();
  const bits = [`Requirement ${requirementNo} raised`];
  if (delivered > 0.0005) {
    bits.push(`${delivered.toFixed(3)} ct ${channel === 'memo' ? 'issued on' : 'billed on'} ${docNo}`);
  }
  if (sourceNow) bits.push(`shortfall ordered from the supplier`);
  return { ok: `${bits.join(' · ')}.` };
}

/** How much of a spec is on the shelf right now. Drives the live match as you type. */
export async function stockForSpecAction(spec: {
  stoneType?: string; shape?: string; sieveSize?: string; mmSize?: string;
  colour?: string; clarity?: string; lab?: string; certified?: string;
}): Promise<{ inStock: number; lots: number }> {
  await requireUser();
  const [row] = await sql`
    SELECT COALESCE(SUM(b.balance), 0) AS in_stock, count(*)::int AS lots
    FROM lot_balances b JOIN lots l ON l.id = b.lot_id
    WHERE b.balance > 0.0005
      AND l.unit_key = lot_unit_key(
        ${spec.stoneType || null}, ${spec.shape || null}, ${spec.sieveSize || null},
        ${spec.mmSize || null}, ${spec.colour || null}, ${spec.clarity || null},
        ${spec.lab || null}, ${spec.certified || null})`;
  return { inStock: Number(row.in_stock), lots: Number(row.lots) };
}

async function lineContext(lineId: string) {
  const [row] = await sql`
    SELECT rls.requirement_id, rls.party_id AS customer_id,
           rls.stone_type, rls.shape, rls.sieve_size, rls.mm_size, rls.colour, rls.clarity,
           rls.lab, rls.certified,
           rls.quoted_rate, rls.outstanding
    FROM requirement_line_status rls WHERE rls.line_id = ${lineId}`;
  return row as any;
}

async function maybeCloseRequirement(requirementId: string) {
  await sql`
    UPDATE requirements SET status = 'closed'
    WHERE id = ${requirementId} AND status = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM requirement_line_status
        WHERE requirement_id = ${requirementId} AND line_status = 'open' AND outstanding > 0.0005
      )`;
}

/** Sends carats from stock to the customer, on a memo or on a bill. */
export async function deliverAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const lineId = s('lineId');
  const lotId = s('lotId');
  const carats = Number(form.get('carats'));
  const rate = Number(form.get('rate'));
  const on = s('on');
  const channel = s('channel');

  if (!lineId || !lotId) return { error: 'Missing line or lot.' };
  if (!(carats > 0)) return { error: 'Carats must be greater than zero.' };
  if (!(rate >= 0)) return { error: 'Enter a valid rate.' };
  if (!on) return { error: 'Enter a date.' };

  const ctx = await lineContext(lineId);
  if (!ctx) return { error: 'Requirement line not found.' };

  try {
    if (channel === 'memo') {
      const memoNo = await docNoOr(s('memoNo'), 'memo_out');
      await issueOutwardMemo({
        memoNo, partyId: ctx.customer_id, issuedOn: on, dueOn: s('dueOn') || null,
        agent: s('agent') || null, requirementLineId: lineId,
        lines: [{ lotId, carats, rate }],
      });
    } else if (channel === 'bill') {
      const invoiceNo = await docNoOr(s('invoiceNo'), 'invoice');
      await recordDirectSale({
        lotId, carats, rate, on, invoiceNo,
        partyId: ctx.customer_id, requirementLineId: lineId,
      });
    } else {
      return { error: 'Pick memo or bill.' };
    }
  } catch (e) {
    return { error: toMessage(e) ?? (e instanceof Error ? e.message : 'Delivery failed.') };
  }
  await maybeCloseRequirement(ctx.requirement_id);
  revalidate();
  return { ok: `${carats} ct delivered ${channel === 'memo' ? 'on memo' : 'on bill'}.` };
}

/** Buys the shortfall from the market: a supplier memo (linked) or a bill (into stock). */
export async function sourceAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const lineId = s('lineId');
  const supplierId = s('supplierId');
  const carats = Number(form.get('carats'));
  const rate = Number(form.get('rate'));
  const on = s('on');
  const channel = s('channel');

  if (!lineId) return { error: 'Missing line.' };
  if (!supplierId) return { error: 'Select the supplier.' };
  if (!(carats > 0)) return { error: 'Carats must be greater than zero.' };
  if (!(rate >= 0)) return { error: 'Enter a valid rate.' };
  if (!on) return { error: 'Enter a date.' };

  const ctx = await lineContext(lineId);
  if (!ctx) return { error: 'Requirement line not found.' };
  const spec = {
    stoneType: ctx.stone_type || 'Lab Grown',
    shape: ctx.shape, sieveSize: ctx.sieve_size, mmSize: ctx.mm_size,
    colour: ctx.colour, clarity: ctx.clarity,
    lab: ctx.lab, certified: ctx.certified,
  };

  try {
    if (channel === 'memo') {
      const memoNo = await docNoOr(s('memoNo'), 'memo_in');
      const termsRaw = s('termsDays');
      await receiveInwardMemo({
        memoNo, partyId: supplierId, issuedOn: on,
        termsDays: termsRaw ? Number(termsRaw) : null,
        requirementLineId: lineId,
        lines: [{ carats, rate, ...spec }],
      });
    } else if (channel === 'bill') {
      await recordPurchase({
        spec, carats, rate, on, partyId: supplierId, billNo: s('billNo') || null,
      });
    } else {
      return { error: 'Pick memo or bill.' };
    }
  } catch (e) {
    return { error: toMessage(e) ?? (e instanceof Error ? e.message : 'Sourcing failed.') };
  }
  revalidate();
  return {
    ok: channel === 'memo'
      ? `${carats} ct sourced on memo — in memo stock, ready to deliver.`
      : `${carats} ct sourced on bill — in your stock, ready to deliver.`,
  };
}

export async function closeRequirementLineAction(form: FormData): Promise<void> {
  await requireUser();
  await sql`UPDATE requirement_lines SET status = 'closed' WHERE id = ${String(form.get('lineId'))}`;
  const reqId = String(form.get('requirementId') ?? '');
  if (reqId) await maybeCloseRequirement(reqId);
  revalidate();
}

export async function setRequirementStatusAction(form: FormData): Promise<void> {
  await requireUser();
  const status = String(form.get('status')) === 'closed' ? 'closed' : 'open';
  await sql`UPDATE requirements SET status = ${status} WHERE id = ${String(form.get('requirementId'))}`;
  revalidate();
}
