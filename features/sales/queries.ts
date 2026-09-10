import { sql } from '@/db/client';

export type RequirementLine = {
  lineId: string; lineStatus: 'open' | 'closed';
  stoneType: string; shape: string | null; sieveSize: string | null;
  mmSize: string | null; colour: string | null; clarity: string | null; unitKey: string;
  wanted: number; quotedRate: number | null;
  deliveredMemo: number; deliveredDirect: number; delivered: number;
  sourcedPending: number; outstanding: number;
  inStock: number;
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
});

/** Every line, with its live fulfilment state and how much matching stock exists now. */
async function lineRows(opts: { status?: string | null; requirementNo?: string | null }) {
  const status = opts.status ?? null;
  const reqNo = opts.requirementNo ?? null;
  return sql`
    SELECT rls.*, r.notes,
           COALESCE((
             SELECT SUM(b.balance) FROM lot_balances b JOIN lots l ON l.id = b.lot_id
             WHERE l.unit_key = rls.unit_key AND b.balance > 0.0005
           ), 0) AS in_stock
    FROM requirement_line_status rls
    JOIN requirements r ON r.id = rls.requirement_id
    WHERE (${status}::text IS NULL OR rls.requirement_status = ${status})
      AND (${reqNo}::text IS NULL OR rls.requirement_no = ${reqNo})
    ORDER BY rls.raised_on DESC, rls.requirement_no, rls.line_id`;
}

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

export async function getRequirements(
  opts: { status?: 'open' | 'closed' | 'all' } = {},
): Promise<Requirement[]> {
  const st = opts.status ?? 'open';
  const rows = await lineRows({ status: st === 'all' ? null : st });
  return group(rows as any[]);
}

export async function getRequirement(requirementNo: string): Promise<Requirement | null> {
  const rows = await lineRows({ requirementNo });
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
