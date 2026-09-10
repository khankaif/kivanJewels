import { sql } from '@/db/client';

export type Bill = {
  billKey: string; billNo: string | null; isCash: boolean;
  direction: 'sale' | 'purchase';
  partyId: string; partyName: string;
  billedOn: string | null; lastPaidOn: string | null;
  lines: number; gross: number; paid: number; balance: number; ageDays: number | null;
};

export type BillFilters = {
  direction?: 'sale' | 'purchase';
  status?: 'all' | 'unpaid' | 'paid';
  partyId?: string;
  from?: string;
  to?: string;
  q?: string;
  namedOnly?: boolean;
  limit?: number;
  offset?: number;
};

function whereFor(f: BillFilters) {
  return {
    direction: f.direction ?? null,
    status: f.status ?? 'all',
    partyId: f.partyId || null,
    from: f.from || null,
    to: f.to || null,
    q: f.q ? `%${f.q}%` : null,
    named: f.namedOnly ?? false,
  };
}

export async function getBills(f: BillFilters = {}): Promise<{ rows: Bill[]; total: number; totals: { gross: number; paid: number; balance: number } }> {
  const w = whereFor(f);
  const limit = f.limit ?? 100;
  const offset = f.offset ?? 0;

  const rows = await sql`
    SELECT * FROM bills
    WHERE (${w.direction}::text IS NULL OR direction = ${w.direction})
      AND (${w.partyId}::uuid IS NULL OR party_id = ${w.partyId}::uuid)
      AND (${w.from}::text  IS NULL OR billed_on >= ${w.from})
      AND (${w.to}::text    IS NULL OR billed_on <= ${w.to})
      AND (${w.q}::text     IS NULL OR bill_no ILIKE ${w.q} OR party_name ILIKE ${w.q})
      AND (NOT ${w.named}::boolean OR bill_no IS NOT NULL)
      AND (${w.status} = 'all'
           OR (${w.status} = 'unpaid' AND balance > 0.005)
           OR (${w.status} = 'paid'   AND balance <= 0.005))
    ORDER BY billed_on DESC NULLS LAST, gross DESC
    LIMIT ${limit} OFFSET ${offset}`;

  const [agg] = await sql`
    SELECT count(*)::int AS total,
           COALESCE(SUM(gross),0)   AS gross,
           COALESCE(SUM(paid),0)    AS paid,
           COALESCE(SUM(balance),0) AS balance
    FROM bills
    WHERE (${w.direction}::text IS NULL OR direction = ${w.direction})
      AND (${w.partyId}::uuid IS NULL OR party_id = ${w.partyId}::uuid)
      AND (${w.from}::text  IS NULL OR billed_on >= ${w.from})
      AND (${w.to}::text    IS NULL OR billed_on <= ${w.to})
      AND (${w.q}::text     IS NULL OR bill_no ILIKE ${w.q} OR party_name ILIKE ${w.q})
      AND (NOT ${w.named}::boolean OR bill_no IS NOT NULL)
      AND (${w.status} = 'all'
           OR (${w.status} = 'unpaid' AND balance > 0.005)
           OR (${w.status} = 'paid'   AND balance <= 0.005))`;

  return {
    rows: (rows as any[]).map(mapBill),
    total: agg.total as number,
    totals: { gross: Number(agg.gross), paid: Number(agg.paid), balance: Number(agg.balance) },
  };
}

const mapBill = (r: any): Bill => ({
  billKey: r.bill_key, billNo: r.bill_no, isCash: !!r.is_cash, direction: r.direction,
  partyId: r.party_id, partyName: r.party_name,
  billedOn: r.billed_on, lastPaidOn: r.last_paid_on,
  lines: r.lines, gross: Number(r.gross), paid: Number(r.paid),
  balance: Number(r.balance), ageDays: r.age_days === null ? null : Number(r.age_days),
});

export async function getBill(billKey: string, direction: 'sale' | 'purchase'): Promise<Bill | null> {
  const rows = await sql`
    SELECT * FROM bills WHERE bill_key = ${billKey} AND direction = ${direction}`;
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
           mv.carats, mv.rate
    FROM keyed k
    LEFT JOIN lots l
      ON l.lot_no = k.ref_id AND k.ref_type = 'diamond_hisab'
    LEFT JOIN LATERAL (
      SELECT m.carats, m.rate FROM movements m
      WHERE m.lot_id = l.id
        AND m.kind = CASE WHEN k.dir = 'sale' THEN 'sale' ELSE 'purchase' END
      LIMIT 1
    ) mv ON true
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
