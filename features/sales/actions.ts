'use server';

import { revalidatePath } from 'next/cache';
import { sql, withTx } from '@/db/client';
import { auth } from '@/lib/auth/server';
import {
  issueOutwardMemo, receiveInwardMemo, recordDirectSale, recordPurchase,
  SettlementError, OverdrawError,
} from '@/lib/ledger/movements';

export type ActionState = { error: string } | { ok: string } | null;

async function requireUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
}

const PATHS = ['/', '/sales', '/stock', '/movements', '/memos', '/accounts/bills', '/accounts', '/parties'];
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

type LineInput = {
  stoneType?: string; shape?: string; sieveSize?: string; mmSize?: string;
  colour?: string; clarity?: string; carats: number; quotedRate?: number | null;
};

/** Creates a customer requirement with one or more spec lines. */
export async function createRequirementAction(_p: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const partyId = String(form.get('partyId') ?? '');
  const raisedOn = String(form.get('raisedOn') ?? '');
  const agent = String(form.get('agent') ?? '').trim() || null;
  const notes = String(form.get('notes') ?? '').trim() || null;

  if (!partyId) return { error: 'Select the customer.' };
  if (!raisedOn) return { error: 'Enter a date.' };

  let lines: LineInput[];
  try {
    lines = JSON.parse(String(form.get('lines') ?? '[]'));
  } catch {
    return { error: 'Could not read the line items.' };
  }
  lines = lines.filter((l) => Number(l.carats) > 0);
  if (!lines.length) return { error: 'Add at least one line with carats.' };
  for (const l of lines) {
    if (!l.sieveSize?.trim() && !l.mmSize?.trim()) {
      return { error: 'Every line needs a sieve or an MM size.' };
    }
  }

  let requirementNo = '';
  try {
    await withTx(async (c) => {
      const { rows: [r] } = await c.query(
        `INSERT INTO requirements (party_id, raised_on, agent, notes)
         VALUES ($1,$2,$3,$4) RETURNING id, requirement_no`,
        [partyId, raisedOn, agent, notes],
      );
      requirementNo = r.requirement_no;
      for (const l of lines) {
        await c.query(
          `INSERT INTO requirement_lines
             (requirement_id, stone_type, shape, sieve_size, mm_size, colour, clarity, carats, quoted_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [r.id, l.stoneType?.trim() || 'Lab Grown', l.shape?.trim() || null,
           l.sieveSize?.trim() || null, l.mmSize?.trim() || null,
           l.colour?.trim() || null, l.clarity?.trim() || null,
           Number(l.carats), l.quotedRate ? Number(l.quotedRate) : null],
        );
      }
    });
  } catch (e) {
    return { error: toMessage(e) ?? (e instanceof Error ? e.message : 'Could not save.') };
  }
  revalidate();
  return { ok: `Requirement ${requirementNo} raised.` };
}

async function lineContext(lineId: string) {
  const [row] = await sql`
    SELECT rls.requirement_id, rls.party_id AS customer_id,
           rls.stone_type, rls.shape, rls.sieve_size, rls.mm_size, rls.colour, rls.clarity,
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
      const memoNo = s('memoNo');
      if (!memoNo) return { error: 'Enter the customer memo number.' };
      await issueOutwardMemo({
        memoNo, partyId: ctx.customer_id, issuedOn: on, dueOn: s('dueOn') || null,
        agent: s('agent') || null, requirementLineId: lineId,
        lines: [{ lotId, carats, rate }],
      });
    } else if (channel === 'bill') {
      const invoiceNo = s('invoiceNo');
      if (!invoiceNo) return { error: 'Enter the invoice number.' };
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
  };

  try {
    if (channel === 'memo') {
      const memoNo = s('memoNo');
      if (!memoNo) return { error: 'Enter the supplier memo number.' };
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
