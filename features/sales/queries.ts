import { sql } from '@/db/client';
import { specLabel } from '@/lib/format';

export type RequirementLine = {
  lineId: string; lineStatus: 'open' | 'closed';
  stoneType: string; shape: string | null; sieveSize: string | null;
  mmSize: string | null; colour: string | null; clarity: string | null; unitKey: string;
  wanted: number; quotedRate: number | null;
  deliveredMemo: number; deliveredDirect: number; delivered: number;
  sourcedPending: number; outstanding: number;
  inStock: number;
  /** How the line was meant to be filled when it was raised. Intent, not truth. */
  planStock: number | null; planSource: number | null;
};

export type Requirement = {
  id: string; requirementNo: string; partyId: string; partyName: string;
  raisedOn: string; agent: string | null; status: 'open' | 'closed'; notes: string | null;
  wanted: number; outstanding: number;
  lines: RequirementLine[];
};

const mapLine = (r: any): RequirementLine => ({
  lineId: r.line_id, lineStatus: r.line_status,
  stoneType: r.stone_type, shape: r.shape, sieveSize: r.sieve_size, mmSize: r.mm_size,
  colour: r.colour, clarity: r.clarity, unitKey: r.unit_key,
  wanted: Number(r.wanted), quotedRate: r.quoted_rate === null ? null : Number(r.quoted_rate),
  deliveredMemo: Number(r.delivered_memo), deliveredDirect: Number(r.delivered_direct),
  delivered: Number(r.delivered), sourcedPending: Number(r.sourced_pending),
  outstanding: Number(r.outstanding), inStock: Number(r.in_stock),
  planStock: r.plan_stock === null ? null : Number(r.plan_stock),
  planSource: r.plan_source === null ? null : Number(r.plan_source),
});

function group(rows: any[]): Requirement[] {
  const out = new Map<string, Requirement>();
  for (const r of rows) {
    let req = out.get(r.requirement_id);
    if (!req) {
      req = {
        id: r.requirement_id, requirementNo: r.requirement_no, partyId: r.party_id,
        partyName: r.party_name, raisedOn: r.raised_on, agent: r.agent,
        status: r.requirement_status, notes: r.notes,
        wanted: 0, outstanding: 0, lines: [],
      };
      out.set(r.requirement_id, req);
    }
    const line = mapLine(r);
    req.lines.push(line);
    req.wanted += line.wanted;
    if (line.lineStatus === 'open') req.outstanding += Math.max(line.outstanding, 0);
  }
  return [...out.values()];
}

/** One requirement's lines, with live fulfilment state and how much matching stock exists now. */
export async function getRequirement(requirementNo: string): Promise<Requirement | null> {
  const rows = await sql`
    SELECT rls.*, r.notes,
           COALESCE((
             SELECT SUM(b.balance) FROM lot_balances b JOIN lots l ON l.id = b.lot_id
             WHERE l.unit_key = rls.unit_key AND b.balance > 0.0005
           ), 0) AS in_stock
    FROM requirement_line_status rls
    JOIN requirements r ON r.id = rls.requirement_id
    WHERE rls.requirement_no = ${requirementNo}
    ORDER BY rls.raised_on DESC, rls.line_id`;
  return group(rows as any[])[0] ?? null;
}

export type SpecLot = {
  lotId: string; lotNo: string; source: string; onMemo: boolean;
  balance: number; costRate: number; partyName: string | null;
};

/**
 * Lots a delivery can come from. `exact` are the spec match; `others` is
 * everything else with a balance, for substitutions.
 */
export async function getDeliverableStock(unitKey: string): Promise<{ exact: SpecLot[]; others: SpecLot[] }> {
  const rows = await sql`
    SELECT b.lot_id, b.lot_no, b.source, b.party_name,
           b.balance, COALESCE(b.cost_rate, 0) AS cost_rate,
           (l.unit_key = ${unitKey}) AS is_exact
    FROM lot_balances b JOIN lots l ON l.id = b.lot_id
    WHERE b.balance > 0.0005
    ORDER BY (l.unit_key = ${unitKey}) DESC, b.balance DESC
    LIMIT 400`;
  const map = (r: any): SpecLot => ({
    lotId: r.lot_id, lotNo: r.lot_no, source: r.source, onMemo: r.source === 'memo_in',
    balance: Number(r.balance), costRate: Number(r.cost_rate), partyName: r.party_name,
  });
  return {
    exact: (rows as any[]).filter((r) => r.is_exact).map(map),
    others: (rows as any[]).filter((r) => !r.is_exact).map(map),
  };
}

export const STAGES = ['new', 'sourcing', 'ready', 'approval', 'closed'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  new: 'New', sourcing: 'Sourcing', ready: 'Ready to send',
  approval: 'On approval', closed: 'Billed / closed',
};

export type PipelineRow = {
  id: string; requirementNo: string; partyId: string; partyName: string;
  raisedOn: string; agent: string | null; ageDays: number;
  outstanding: number; onApproval: number; sourcedPending: number;
  covered: boolean; openLines: number; stage: Stage;
  /** The spec of the first open line, so a row reads without opening it. */
  headline: string | null;
  /** The line a stage action should act on. */
  nextLineId: string | null;
};

/**
 * The board. Stage is computed in SQL (see requirement_pipeline); the headline
 * spec is joined on here so a row says what it is without a second click.
 */
export type PipelineFilters = { partyId?: string; agent?: string; q?: string };

export async function getPipeline(f: PipelineFilters = {}): Promise<PipelineRow[]> {
  const partyId = f.partyId || null;
  const agent = f.agent || null;
  const q = f.q ? `%${f.q}%` : null;
  const rows = await sql`
    SELECT rp.*, hl.line_id, hl.sieve_size, hl.mm_size, hl.shape, hl.colour, hl.clarity,
           hl.lab, hl.certified
    FROM requirement_pipeline rp
    LEFT JOIN LATERAL (
      SELECT line_id, sieve_size, mm_size, shape, colour, clarity, lab, certified
      FROM requirement_line_status
      WHERE requirement_id = rp.id AND line_status = 'open'
      ORDER BY outstanding DESC LIMIT 1
    ) hl ON true
    WHERE (${partyId}::uuid IS NULL OR rp.party_id = ${partyId}::uuid)
      AND (${agent}::text IS NULL OR rp.agent = ${agent})
      AND (${q}::text IS NULL
           OR rp.requirement_no ILIKE ${q} OR rp.party_name ILIKE ${q}
           OR hl.sieve_size ILIKE ${q} OR hl.mm_size ILIKE ${q}
           OR hl.shape ILIKE ${q} OR hl.colour ILIKE ${q} OR hl.clarity ILIKE ${q})
    ORDER BY rp.raised_on DESC, rp.requirement_no DESC`;

  return (rows as any[]).map((r) => ({
    id: r.id, requirementNo: r.requirement_no, partyId: r.party_id, partyName: r.party_name,
    raisedOn: r.raised_on, agent: r.agent, ageDays: Number(r.age_days),
    outstanding: Number(r.outstanding), onApproval: Number(r.on_approval),
    sourcedPending: Number(r.sourced_pending), covered: !!r.covered,
    openLines: r.open_lines, stage: r.stage as Stage,
    headline: r.line_id ? specLabel(mapSpec(r)) : null,
    nextLineId: r.line_id ?? null,
  }));
}

const mapSpec = (r: any) => ({
  sieveSize: r.sieve_size, mmSize: r.mm_size, shape: r.shape,
  colour: r.colour, clarity: r.clarity, lab: r.lab, certified: r.certified,
});

export type AdhocApproval = {
  memoId: string; memoNo: string; partyId: string; partyName: string;
  issuedOn: string; dueOn: string | null; overdue: boolean;
  outstanding: number; headline: string | null;
};

/**
 * Goods out on a customer memo that never came from a requirement -- the walk-in
 * half of the business. They belong on the board: the question "what is with a
 * customer right now" does not care how it got there.
 */
export async function getAdhocApprovals(f: PipelineFilters = {}): Promise<AdhocApproval[]> {
  const partyId = f.partyId || null;
  const q = f.q ? `%${f.q}%` : null;
  const rows = await sql`
    SELECT m.id AS memo_id, m.memo_no, m.party_id, p.name AS party_name,
           m.issued_on::text AS issued_on, m.due_on::text AS due_on,
           (m.due_on IS NOT NULL AND m.due_on < CURRENT_DATE) AS overdue,
           SUM(s.outstanding) AS outstanding,
           MAX(l.sieve_size) AS sieve_size, MAX(l.mm_size) AS mm_size, MAX(l.shape) AS shape,
           MAX(l.colour) AS colour, MAX(l.clarity) AS clarity,
           MAX(l.lab) AS lab, MAX(l.certified) AS certified
    FROM memo_line_status s
    JOIN memo_lines ml ON ml.id = s.line_id
    JOIN memos      m  ON m.id = ml.memo_id
    JOIN parties    p  ON p.id = m.party_id
    JOIN lots       l  ON l.id = s.lot_id
    WHERE s.direction = 'out' AND s.line_status = 'open'
      AND ml.requirement_line_id IS NULL
      AND (${partyId}::uuid IS NULL OR m.party_id = ${partyId}::uuid)
      AND (${q}::text IS NULL OR m.memo_no ILIKE ${q} OR p.name ILIKE ${q})
    GROUP BY m.id, m.memo_no, m.party_id, p.name, m.issued_on, m.due_on
    HAVING SUM(s.outstanding) > 0.0005
    ORDER BY (m.due_on IS NOT NULL AND m.due_on < CURRENT_DATE) DESC, m.due_on NULLS LAST`;

  return (rows as any[]).map((r) => ({
    memoId: r.memo_id, memoNo: r.memo_no, partyId: r.party_id, partyName: r.party_name,
    issuedOn: r.issued_on, dueOn: r.due_on, overdue: !!r.overdue,
    outstanding: Number(r.outstanding), headline: specLabel(mapSpec(r)),
  }));
}

export type SellableUnit = {
  lotId: string; lotNo: string; label: string; balance: number;
  onMemo: boolean; partyName: string | null; costRate: number;
};

/**
 * What can actually be sold today, newest-largest first: owned units, then
 * parcels held on a supplier memo (which can go out back-to-back, but are
 * still the supplier's goods until billed).
 */
export async function getSellableUnits(limit = 400): Promise<SellableUnit[]> {
  const rows = await sql`
    SELECT lot_id, lot_no, source, party_name, balance, COALESCE(cost_rate, 0) AS cost_rate,
           stone_type, spec_sieve(sieve_size) AS sieve_size, spec_mm(mm_size) AS mm_size,
           shape, colour, clarity, lab, certified
    FROM lot_balances
    WHERE balance > 0.0005
    ORDER BY (source = 'unit') DESC, balance DESC
    LIMIT ${limit}`;

  return (rows as any[]).map((r) => ({
    lotId: r.lot_id, lotNo: r.lot_no,
    label: `${specLabel(mapSpec(r))} · ${r.stone_type}`,
    balance: Number(r.balance), onMemo: r.source === 'memo_in',
    partyName: r.party_name, costRate: Number(r.cost_rate),
  }));
}

export type RequirementDoc = {
  kind: 'memo' | 'invoice' | 'purchase' | 'payment';
  ref: string; partyName: string; datedOn: string;
  carats: number | null; amount: number | null; note: string | null;
};

/**
 * Every document one requirement produced, in the order it happened: the memos
 * issued or received against it, the invoices those became, and the money that
 * settled them. The funnel, read from the top.
 */
export async function getRequirementDocuments(requirementId: string): Promise<RequirementDoc[]> {
  const rows = await sql`
    WITH lines AS (
      SELECT id FROM requirement_lines WHERE requirement_id = ${requirementId}
    ),
    memo_docs AS (
      SELECT
        'memo' AS kind, m.memo_no AS ref, p.name AS party_name, m.issued_on::text AS dated_on,
        SUM(ml.carats) AS carats, NULL::numeric AS amount,
        CASE WHEN m.direction = 'out' THEN 'issued to the customer'
             ELSE 'received from the supplier' END AS note
      FROM memo_lines ml
      JOIN memos   m ON m.id = ml.memo_id
      JOIN parties p ON p.id = m.party_id
      WHERE ml.requirement_line_id IN (SELECT id FROM lines)
      GROUP BY m.memo_no, p.name, m.issued_on, m.direction
    ),
    money_docs AS (
      SELECT
        CASE WHEN g.kind = 'sale_invoice' THEN 'invoice'
             WHEN g.kind = 'purchase_invoice' THEN 'purchase'
             ELSE 'payment' END AS kind,
        COALESCE(g.bill_no, g.ref_id, g.id::text) AS ref,
        p.name AS party_name, g.dated_on::text AS dated_on,
        NULL::numeric AS carats, ABS(g.amount) AS amount, g.notes AS note
      FROM ledger g
      JOIN parties p ON p.id = g.party_id
      LEFT JOIN memo_lines ml ON ml.id = g.memo_line_id
      WHERE COALESCE(g.requirement_line_id, ml.requirement_line_id) IN (SELECT id FROM lines)
    )
    SELECT * FROM memo_docs
    UNION ALL
    SELECT * FROM money_docs
    ORDER BY dated_on, kind`;

  return (rows as any[]).map((r) => ({
    kind: r.kind, ref: r.ref, partyName: r.party_name, datedOn: r.dated_on,
    carats: r.carats === null ? null : Number(r.carats),
    amount: r.amount === null ? null : Number(r.amount),
    note: r.note,
  }));
}
