import { sql } from '@/db/client';
import type { Sort } from '@/lib/sort';
import { specLabel } from '@/lib/format';

export type Bill = {
  billKey: string; billNo: string | null; isCash: boolean;
  direction: 'sale' | 'purchase';
  partyId: string; partyName: string; partyPhone: string | null;
  billedOn: string | null; lastPaidOn: string | null; dueOn: string | null;
  lines: number; gross: number; paid: number; balance: number;
  ageDays: number | null; daysOverdue: number | null;
  status: 'paid' | 'part' | 'due' | 'overdue';
};

export const BILL_SORTS = ['date', 'party', 'amount', 'balance', 'due'] as const;
export type BillSort = Sort<(typeof BILL_SORTS)[number]>;

export type BillFilters = {
  sort?: BillSort;
  direction?: 'sale' | 'purchase';
  status?: 'all' | 'unpaid' | 'paid' | 'overdue';
  partyId?: string;
  from?: string;
  to?: string;
  q?: string;
  namedOnly?: boolean;
  limit?: number;
  offset?: number;
};

/** Whitelisted columns only: the sort arrives from the URL. */
function billOrder(s: BillSort | undefined) {
  const dir = s?.dir === 'asc' ? sql`ASC` : sql`DESC`;
  switch (s?.col) {
    case 'party': return sql`party_name ${dir}, billed_on DESC`;
    case 'amount': return sql`gross ${dir} NULLS LAST`;
    case 'balance': return sql`balance ${dir} NULLS LAST`;
    case 'due': return sql`due_on::date ${dir} NULLS LAST`;
    default: return sql`billed_on ${dir} NULLS LAST, gross DESC`;
  }
}

export async function getBills(f: BillFilters = {}): Promise<{ rows: Bill[]; total: number; totals: { gross: number; paid: number; balance: number } }> {
  const direction = f.direction ?? null;
  const status = f.status ?? 'all';
  const partyId = f.partyId || null;
  const from = f.from || null;
  const to = f.to || null;
  const q = f.q ? `%${f.q}%` : null;
  const limit = f.limit ?? 100;
  const offset = f.offset ?? 0;

  const where = sql`
    WHERE (${direction}::text IS NULL OR direction = ${direction})
      AND (${partyId}::uuid IS NULL OR party_id = ${partyId}::uuid)
      AND (${from}::text  IS NULL OR billed_on >= ${from})
      AND (${to}::text    IS NULL OR billed_on <= ${to})
      AND (${q}::text     IS NULL OR bill_no ILIKE ${q} OR party_name ILIKE ${q})
      AND (NOT ${f.namedOnly ?? false}::boolean OR bill_no IS NOT NULL)
      AND (${status} = 'all'
           OR (${status} = 'unpaid'  AND balance > 0.005)
           OR (${status} = 'paid'    AND balance <= 0.005)
           OR (${status} = 'overdue' AND status = 'overdue'))`;

  const rows = await sql`
    SELECT *, (SELECT phone FROM parties p WHERE p.id = bills.party_id) AS party_phone FROM bills ${where}
    ORDER BY ${billOrder(f.sort)}
    LIMIT ${limit} OFFSET ${offset}`;

  const [agg] = await sql`
    SELECT count(*)::int AS total,
           COALESCE(SUM(gross),0)   AS gross,
           COALESCE(SUM(paid),0)    AS paid,
           COALESCE(SUM(balance),0) AS balance
    FROM bills ${where}`;

  return {
    rows: (rows as any[]).map(mapBill),
    total: agg.total as number,
    totals: { gross: Number(agg.gross), paid: Number(agg.paid), balance: Number(agg.balance) },
  };
}

const mapBill = (r: any): Bill => ({
  billKey: r.bill_key, billNo: r.bill_no, isCash: !!r.is_cash, direction: r.direction,
  partyId: r.party_id, partyName: r.party_name, partyPhone: r.party_phone ?? null,
  billedOn: r.billed_on, lastPaidOn: r.last_paid_on, dueOn: r.due_on,
  lines: r.lines, gross: Number(r.gross), paid: Number(r.paid),
  balance: Number(r.balance), ageDays: r.age_days === null ? null : Number(r.age_days),
  daysOverdue: r.days_overdue === null ? null : Number(r.days_overdue),
  status: r.status,
});

export async function getBill(billKey: string, direction: 'sale' | 'purchase'): Promise<Bill | null> {
  const rows = await sql`
    SELECT *, (SELECT phone FROM parties p WHERE p.id = bills.party_id) AS party_phone
    FROM bills WHERE bill_key = ${billKey} AND direction = ${direction}`;
  return rows.length ? mapBill(rows[0]) : null;
}

export type BillLine = {
  id: string; datedOn: string; kind: string; amount: number;
  refId: string | null; notes: string | null;
  lotNo: string | null; stoneType: string | null; shape: string | null;
  sieveSize: string | null; carats: number | null; rate: number | null;
};

/**
 * Every row behind one bill, joined to the stone it moved.
 * Imported ledger rows carry ref_id = the source row id, and the import named
 * each lot 'DH-<ref_id>', so the stone detail is recoverable for the whole
 * historical book, not just for rows created in the app.
 */
export async function getBillLines(billKey: string, direction: 'sale' | 'purchase'): Promise<BillLine[]> {
  const rows = await sql`
    WITH keyed AS (
      SELECT g.*,
        CASE WHEN g.bill_no IS NULL OR g.bill_no = '' OR lower(g.bill_no) IN ('cash','bill')
             THEN COALESCE(g.ref_type,'') || ':' || COALESCE(g.ref_id, g.id::text)
             ELSE g.bill_no END AS bill_key,
        CASE WHEN g.kind IN ('sale_invoice','payment_in') THEN 'sale' ELSE 'purchase' END AS dir
      FROM ledger g
    )
    SELECT k.id, k.dated_on::text AS dated_on, k.kind, k.amount, k.ref_id, k.notes,
           l.lot_no, l.stone_type, l.shape, l.sieve_size,
           COALESCE(mb.carats, mv.carats) AS carats, COALESCE(mb.rate, mv.rate) AS rate
    FROM keyed k
    -- Three ways a ledger row names its parcel: the import's 'DH-<id>' lot
    -- number, a purchase's lot_id, or the memo line a memo bill settled.
    LEFT JOIN lots l
      ON (k.ref_type = 'diamond_hisab' AND l.lot_no = k.ref_id)
      OR l.id = k.lot_id
      OR l.id = (SELECT ml.lot_id FROM memo_lines ml WHERE ml.id = k.memo_line_id)
    LEFT JOIN LATERAL (
      SELECT m.carats, m.rate FROM movements m
      WHERE m.lot_id = l.id
        AND m.kind = CASE WHEN k.dir = 'sale' THEN 'sale' ELSE 'purchase' END
      LIMIT 1
    ) mv ON true
    -- A memo bill's carats are the ones billed on that line, not the parcel's.
    LEFT JOIN LATERAL (
      SELECT b.carats, round(abs(k.amount) / NULLIF(b.carats, 0), 2) AS rate
      FROM memo_line_billings b
      WHERE b.memo_line_id = k.memo_line_id AND b.invoice_no = k.bill_no
      LIMIT 1
    ) mb ON k.memo_line_id IS NOT NULL
    WHERE k.bill_key = ${billKey} AND k.dir = ${direction}
    ORDER BY k.kind, k.dated_on, l.lot_no`;

  return (rows as any[]).map((r) => ({
    id: r.id, datedOn: r.dated_on, kind: r.kind, amount: Number(r.amount),
    refId: r.ref_id, notes: r.notes, lotNo: r.lot_no, stoneType: r.stone_type,
    shape: r.shape, sieveSize: r.sieve_size,
    carats: r.carats === null ? null : Math.abs(Number(r.carats)),
    rate: r.rate === null ? null : Number(r.rate),
  }));
}

export type TrailRow = {
  ledgerId: string; kind: string; datedOn: string; amount: number; notes: string | null;
  memoNo: string | null; memoDirection: 'in' | 'out' | null; memoIssuedOn: string | null;
  requirementNo: string | null; requirementParty: string | null;
  lotNo: string | null; stoneType: string | null; spec: string;
};

/**
 * What is behind a bill: the parcel each line came out of, the memo it settled,
 * and the requirement it was raised against.
 *
 * This is the funnel read backwards. It only answers for rows written since the
 * links existed -- the imported historical book has no memo or requirement
 * behind it, and says so rather than inventing one.
 */
export async function getBillTrail(billKey: string, direction: 'sale' | 'purchase'): Promise<TrailRow[]> {
  const rows = await sql`
    SELECT * FROM bill_trail
    WHERE direction = ${direction}
      AND COALESCE(bill_no, COALESCE(kind, '') || ':' || ledger_id::text) = ${billKey}
      AND kind IN ('sale_invoice', 'purchase_invoice')
    ORDER BY dated_on, memo_no NULLS LAST`;

  return (rows as any[]).map((r) => ({
    ledgerId: r.ledger_id, kind: r.kind, datedOn: r.dated_on, amount: Math.abs(Number(r.amount)),
    notes: r.notes,
    memoNo: r.memo_no, memoDirection: r.memo_direction, memoIssuedOn: r.memo_issued_on,
    requirementNo: r.requirement_no, requirementParty: r.requirement_party,
    lotNo: r.lot_no, stoneType: r.stone_type, spec: specLabel(r),
  }));
}

