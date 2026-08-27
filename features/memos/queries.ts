import { sql } from '@/db/client';

export type MemoLine = {
  lineId: string; lotNo: string; stoneType: string; sieveSize: string | null;
  carats: number; rate: number; returned: number; billed: number;
  outstanding: number; status: string;
};

export type Memo = {
  memoId: string; memoNo: string; partyName: string; issuedOn: string;
  dueOn: string | null; status: string; overdue: boolean;
  carats: number; value: number; outstanding: number; lines: MemoLine[];
};

export async function getOutwardMemos(): Promise<Memo[]> {
  const rows = await sql`
    SELECT m.id AS memo_id, m.memo_no, m.issued_on, m.due_on, m.status,
           p.name AS party_name,
           (m.status = 'open' AND m.due_on IS NOT NULL AND m.due_on < CURRENT_DATE) AS overdue,
           ml.id AS line_id, l.lot_no, l.stone_type, l.sieve_size,
           ml.carats, ml.rate, ml.status AS line_status,
           COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
                     WHERE mv.memo_line_id = ml.id AND mv.kind = 'memo_out_return'), 0) AS returned,
           COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
                     WHERE b.memo_line_id = ml.id), 0) AS billed
    FROM memos m
    JOIN parties p ON p.id = m.party_id
    LEFT JOIN memo_lines ml ON ml.memo_id = m.id
    LEFT JOIN lots l ON l.id = ml.lot_id
    WHERE m.direction = 'out'
    ORDER BY m.issued_on DESC, m.memo_no, l.lot_no`;

  const byMemo = new Map<string, Memo>();
  for (const r of rows as any[]) {
    let memo = byMemo.get(r.memo_id);
    if (!memo) {
      memo = {
        memoId: r.memo_id, memoNo: r.memo_no, partyName: r.party_name,
        issuedOn: r.issued_on instanceof Date ? r.issued_on.toISOString().slice(0, 10) : String(r.issued_on),
        dueOn: r.due_on ? (r.due_on instanceof Date ? r.due_on.toISOString().slice(0, 10) : String(r.due_on)) : null,
        status: r.status, overdue: !!r.overdue,
        carats: 0, value: 0, outstanding: 0, lines: [],
      };
      byMemo.set(r.memo_id, memo);
    }
    if (!r.line_id) continue;
    const carats = Number(r.carats);
    const rate = Number(r.rate);
    const returned = Number(r.returned);
    const billed = Number(r.billed);
    const outstanding = Math.round((carats - returned - billed) * 1000) / 1000;
    memo.lines.push({
      lineId: r.line_id, lotNo: r.lot_no, stoneType: r.stone_type, sieveSize: r.sieve_size,
      carats, rate, returned, billed, outstanding, status: r.line_status,
    });
    memo.carats += carats;
    memo.value += carats * rate;
    memo.outstanding += outstanding;
  }
  return [...byMemo.values()];
}

export async function getParties(): Promise<{ id: string; name: string }[]> {
  const rows = await sql`SELECT id, name FROM parties ORDER BY name`;
  return rows.map((r: any) => ({ id: r.id, name: r.name }));
}
