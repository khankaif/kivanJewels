import { sql } from '@/db/client';

export type MemoLine = {
  lineId: string; lotId: string; lotNo: string; stoneType: string;
  shape: string | null; sieveSize: string | null; mmSize: string | null;
  carats: number; rate: number; returned: number; billed: number;
  billedAmount: number; outstanding: number; status: string;
};

export type Memo = {
  memoId: string; memoNo: string; direction: 'in' | 'out';
  partyId: string; partyName: string; agent: string | null;
  issuedOn: string; dueOn: string | null; status: string; overdue: boolean;
  carats: number; value: number; outstanding: number; lines: MemoLine[];
};

/** Dates arrive as text from memo_line_status: a calendar date carries no time zone. */
export async function getMemos(direction: 'in' | 'out'): Promise<Memo[]> {
  const rows = await sql`
    SELECT * FROM memo_line_status
    WHERE direction = ${direction}
    ORDER BY (memo_status = 'open') DESC, issued_on DESC, memo_no, lot_no`;

  const byMemo = new Map<string, Memo>();
  for (const r of rows as any[]) {
    let memo = byMemo.get(r.memo_id);
    if (!memo) {
      memo = {
        memoId: r.memo_id, memoNo: r.memo_no, direction: r.direction,
        partyId: r.party_id, partyName: r.party_name, agent: r.agent,
        issuedOn: r.issued_on, dueOn: r.due_on, status: r.memo_status,
        overdue: !!r.overdue, carats: 0, value: 0, outstanding: 0, lines: [],
      };
      byMemo.set(r.memo_id, memo);
    }
    const carats = Number(r.carats);
    const rate = Number(r.rate);
    const outstanding = Number(r.outstanding);
    memo.lines.push({
      lineId: r.line_id, lotId: r.lot_id, lotNo: r.lot_no, stoneType: r.stone_type,
      shape: r.shape, sieveSize: r.sieve_size, mmSize: r.mm_size,
      carats, rate, returned: Number(r.returned), billed: Number(r.billed),
      billedAmount: Number(r.billed_amount), outstanding, status: r.line_status,
    });
    memo.carats += carats;
    memo.value += carats * rate;
    memo.outstanding += outstanding;
  }
  return [...byMemo.values()];
}

export async function getMemoSummary() {
  const rows = await sql`
    SELECT direction,
           count(DISTINCT memo_id) FILTER (WHERE memo_status = 'open')::int AS open,
           count(DISTINCT memo_id) FILTER (WHERE overdue)::int              AS overdue,
           COALESCE(SUM(outstanding) FILTER (WHERE memo_status = 'open'),0) AS carats,
           COALESCE(SUM(outstanding * rate) FILTER (WHERE memo_status = 'open'),0) AS value
    FROM memo_line_status GROUP BY direction`;
  const base = { open: 0, overdue: 0, carats: 0, value: 0 };
  const out = { in: { ...base }, out: { ...base } };
  for (const r of rows as any[]) {
    out[r.direction as 'in' | 'out'] = {
      open: r.open, overdue: r.overdue, carats: Number(r.carats), value: Number(r.value),
    };
  }
  return out;
}

/** Agents seen historically, for the "placed by" picker. */
export async function getAgents(): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT agent FROM memos WHERE agent IS NOT NULL AND agent <> '' ORDER BY agent`;
  return rows.map((r: any) => r.agent);
}
