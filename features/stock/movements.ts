import { sql } from '@/db/client';

export type MovementRow = {
  id: string; movedOn: string; kind: string; carats: number;
  rate: number | null; amount: number | null; notes: string | null;
  lotId: string; lotNo: string; stoneType: string; shape: string | null;
  sieveSize: string | null; partyName: string | null;
  memoNo: string | null; memoDirection: 'in' | 'out' | null;
  isInward: boolean; runningBalance: number;
};

export const MOVEMENT_LABEL: Record<string, string> = {
  purchase: 'Purchased',
  memo_in_receipt: 'Received on memo',
  memo_out_return: 'Returned by client',
  adjust_in: 'Opening / adjustment in',
  sale: 'Sold',
  memo_out_issue: 'Issued on memo',
  memo_in_return: 'Returned to supplier',
  consumed_jewellery: 'Used in jewellery',
  adjust_out: 'Adjustment out',
};

export type MovementFilters = {
  kind?: string; lotNo?: string; q?: string; from?: string; to?: string;
  direction?: 'in' | 'out';
  limit?: number; offset?: number;
};

export async function getMovements(f: MovementFilters = {}) {
  const kind = f.kind || null;
  const lotNo = f.lotNo || null;
  const q = f.q ? `%${f.q}%` : null;
  const from = f.from || null;
  const to = f.to || null;
  const dir = f.direction ?? null;
  const limit = f.limit ?? 200;
  const offset = f.offset ?? 0;

  const rows = await sql`
    SELECT * FROM movement_entries
    WHERE (${kind}::text  IS NULL OR kind = ${kind})
      AND (${lotNo}::text IS NULL OR lot_no = ${lotNo})
      AND (${from}::text  IS NULL OR moved_on >= ${from})
      AND (${to}::text    IS NULL OR moved_on <= ${to})
      AND (${dir}::text   IS NULL
           OR (${dir} = 'in' AND is_inward) OR (${dir} = 'out' AND NOT is_inward))
      AND (${q}::text     IS NULL OR lot_no ILIKE ${q} OR party_name ILIKE ${q}
           OR stone_type ILIKE ${q} OR sieve_size ILIKE ${q} OR memo_no ILIKE ${q})
    ORDER BY moved_on DESC, is_outward DESC, id DESC
    LIMIT ${limit} OFFSET ${offset}`;

  const [agg] = await sql`
    SELECT count(*)::int AS n,
           COALESCE(SUM(carats) FILTER (WHERE is_inward),0)      AS in_ct,
           COALESCE(-SUM(carats) FILTER (WHERE NOT is_inward),0) AS out_ct
    FROM movement_entries
    WHERE (${kind}::text  IS NULL OR kind = ${kind})
      AND (${lotNo}::text IS NULL OR lot_no = ${lotNo})
      AND (${from}::text  IS NULL OR moved_on >= ${from})
      AND (${to}::text    IS NULL OR moved_on <= ${to})
      AND (${dir}::text   IS NULL
           OR (${dir} = 'in' AND is_inward) OR (${dir} = 'out' AND NOT is_inward))
      AND (${q}::text     IS NULL OR lot_no ILIKE ${q} OR party_name ILIKE ${q}
           OR stone_type ILIKE ${q} OR sieve_size ILIKE ${q} OR memo_no ILIKE ${q})`;

  return {
    rows: (rows as any[]).map(map),
    total: agg.n as number,
    inCarats: Number(agg.in_ct),
    outCarats: Number(agg.out_ct),
  };
}

/** One lot's complete history, oldest first, so it reads like a passbook. */
export async function getLotHistory(lotNo: string) {
  const rows = await sql`
    SELECT * FROM movement_entries WHERE lot_no = ${lotNo}
    -- Must mirror the window's ORDER BY exactly, or the running balance appears
    -- to dip negative when several movements share a date.
    ORDER BY moved_on, is_outward, id`;
  return (rows as any[]).map(map);
}

const map = (r: any): MovementRow => ({
  id: r.id, movedOn: r.moved_on, kind: r.kind, carats: Number(r.carats),
  rate: r.rate === null ? null : Number(r.rate),
  amount: r.amount === null ? null : Number(r.amount),
  notes: r.notes, lotId: r.lot_id, lotNo: r.lot_no, stoneType: r.stone_type,
  shape: r.shape, sieveSize: r.sieve_size, partyName: r.party_name,
  memoNo: r.memo_no, memoDirection: r.memo_direction,
  isInward: !!r.is_inward, runningBalance: Number(r.running_balance),
});
