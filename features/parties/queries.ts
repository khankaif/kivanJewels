import { sql } from '@/db/client';

export type Party = {
  id: string; name: string; kind: 'supplier' | 'client' | 'both';
  defaultTermsDays: number; phone: string | null; email: string | null;
  gstin: string | null; notes: string | null; isActive: boolean;
  businessName: string | null; contactPerson: string | null;
  address: string | null; pan: string | null;
  receivable: number; payable: number; net: number;
  openMemosIn: number; openMemosOut: number;
};

export async function getParties(opts: { search?: string; includeInactive?: boolean } = {}): Promise<Party[]> {
  const like = opts.search ? `%${opts.search}%` : null;
  const rows = await sql`
    SELECT p.id, p.name, p.kind, p.default_terms_days, p.phone, p.email,
           p.gstin, p.notes, p.is_active, p.business_name, p.contact_person, p.address, p.pan,
           COALESCE(b.receivable,0) AS receivable,
           COALESCE(b.payable,0)    AS payable,
           COALESCE(b.net,0)        AS net,
           COALESCE((SELECT count(*) FROM memos m
                     WHERE m.party_id = p.id AND m.direction='in'  AND m.status='open'),0)::int AS open_in,
           COALESCE((SELECT count(*) FROM memos m
                     WHERE m.party_id = p.id AND m.direction='out' AND m.status='open'),0)::int AS open_out
    FROM parties p
    LEFT JOIN party_balances b ON b.party_id = p.id
    WHERE (${opts.includeInactive ?? false}::boolean OR p.is_active)
      AND (${like}::text IS NULL
           OR p.name ILIKE ${like} OR p.business_name ILIKE ${like}
           OR p.phone ILIKE ${like} OR p.gstin ILIKE ${like})
    ORDER BY ABS(COALESCE(b.net,0)) DESC, p.name`;

  return rows.map((r: any) => ({
    id: r.id, name: r.name, kind: r.kind, defaultTermsDays: r.default_terms_days,
    phone: r.phone, email: r.email, gstin: r.gstin, notes: r.notes, isActive: r.is_active,
    businessName: r.business_name, contactPerson: r.contact_person, address: r.address, pan: r.pan,
    receivable: Number(r.receivable), payable: Number(r.payable), net: Number(r.net),
    openMemosIn: r.open_in, openMemosOut: r.open_out,
  }));
}

/** Lightweight list for pickers. `kind` filters to who can play that role. */
export async function getPartyOptions(role?: 'supplier' | 'client') {
  const rows = await sql`
    SELECT id, name, default_terms_days FROM parties
    WHERE is_active
      AND (${role ?? null}::text IS NULL OR kind = 'both' OR kind = ${role ?? null})
    ORDER BY name`;
  return rows.map((r: any) => ({
    id: r.id, name: r.name, defaultTermsDays: r.default_terms_days,
  }));
}

export type PartyStatementRow = {
  id: string; datedOn: string; kind: string; billNo: string | null;
  refId: string | null; notes: string | null; mode: string | null;
  amount: number; running: number;
};

export async function getParty(id: string) {
  const rows = await sql`
    SELECT p.*, COALESCE(b.receivable,0) receivable, COALESCE(b.payable,0) payable,
           COALESCE(b.net,0) net
    FROM parties p LEFT JOIN party_balances b ON b.party_id = p.id
    WHERE p.id = ${id}`;
  if (!rows.length) return null;
  const r = rows[0] as any;
  return {
    id: r.id, name: r.name, kind: r.kind, defaultTermsDays: r.default_terms_days,
    phone: r.phone, email: r.email, gstin: r.gstin, notes: r.notes, isActive: r.is_active,
    businessName: r.business_name, contactPerson: r.contact_person, address: r.address, pan: r.pan,
    receivable: Number(r.receivable), payable: Number(r.payable), net: Number(r.net),
  };
}

/**
 * Statement of account: every money row for one party in date order, with a
 * running balance. Positive means they owe us.
 */
export async function getPartyStatement(id: string, limit = 500): Promise<PartyStatementRow[]> {
  const rows = await sql`
    SELECT id, dated_on::text AS dated_on, kind, bill_no, ref_id, notes, mode, amount,
           SUM(amount) OVER (ORDER BY dated_on, created_at, id
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
    FROM ledger WHERE party_id = ${id}
    -- Tie-breakers must mirror the window's ORDER BY exactly, or the running
    -- balance appears to jump around within a single day.
    ORDER BY dated_on DESC, created_at DESC, id DESC
    LIMIT ${limit}`;
  return (rows as any[]).map((r) => ({
    id: r.id, datedOn: r.dated_on, kind: r.kind, billNo: r.bill_no,
    refId: r.ref_id, notes: r.notes, mode: r.mode,
    amount: Number(r.amount), running: Number(r.running),
  }));
}

export async function getPartyActivity(id: string) {
  const [stones] = await sql`
    SELECT
      COALESCE(SUM(ABS(m.carats)) FILTER (WHERE m.kind = 'purchase'),0) AS bought,
      COALESCE(SUM(ABS(m.carats)) FILTER (WHERE m.kind = 'sale'),0)     AS sold
    FROM movements m JOIN lots l ON l.id = m.lot_id
    WHERE l.party_id = ${id}`;
  const memos = await sql`
    SELECT memo_id, memo_no, direction, issued_on, due_on, memo_status, overdue,
           SUM(carats) AS carats, SUM(outstanding) AS outstanding, SUM(carats * rate) AS value
    FROM memo_line_status WHERE party_id = ${id}
    GROUP BY memo_id, memo_no, direction, issued_on, due_on, memo_status, overdue
    ORDER BY issued_on DESC LIMIT 50`;
  return {
    bought: Number(stones.bought), sold: Number(stones.sold),
    memos: (memos as any[]).map((m) => ({
      memoId: m.memo_id, memoNo: m.memo_no, direction: m.direction as 'in' | 'out',
      issuedOn: m.issued_on, dueOn: m.due_on, status: m.memo_status, overdue: !!m.overdue,
      carats: Number(m.carats), outstanding: Number(m.outstanding), value: Number(m.value),
    })),
  };
}
