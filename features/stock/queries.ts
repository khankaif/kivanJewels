import { sql } from '@/db/client';

/**
 * Stock comes in two kinds and they are not the same asset.
 *
 *  - OWNED: bought outright, or bought off a supplier memo. Fungible by spec,
 *    so one row per shape/sieve/mm no matter how many times it was bought.
 *  - MEMO: held from a supplier on approval. Not yours, and not fungible --
 *    that parcel goes back to that supplier, so it stays a parcel.
 */

export type StockUnit = {
  lotId: string; lotNo: string; stoneType: string; shape: string | null;
  sieveSize: string | null; mmSize: string | null; colour: string | null; clarity: string | null;
  costRate: number; balance: number; exposure: number; value: number;
};

export type MemoStock = {
  partyId: string; partyName: string; unitKey: string;
  stoneType: string; shape: string | null; sieveSize: string | null; mmSize: string | null;
  colour: string | null; clarity: string | null;
  outstanding: number; inVault: number; rate: number;
  dueOn: string | null; overdue: boolean; memoNos: string[];
};

/** Owned stock, one row per spec (shape + sieve + mm + colour + clarity). */
export async function getOwnedUnits(opts: { search?: string; limit?: number } = {}): Promise<StockUnit[]> {
  const like = opts.search ? `%${opts.search}%` : null;
  const rows = await sql`
    -- Display the normalized spec, not whichever spelling the surviving lot
    -- happened to carry: a list that reads '2.20 MM' on one row and '1.9' on
    -- the next is the noise this consolidation exists to remove.
    SELECT lot_id, lot_no, stone_type, shape,
           spec_sieve(sieve_size) AS sieve_size, spec_mm(mm_size) AS mm_size,
           colour, clarity,
           COALESCE(cost_rate, 0) AS cost_rate, balance, exposure
    FROM lot_balances
    WHERE source <> 'memo_in'
      AND (balance > 0.0005 OR exposure > 0.0005)
      AND (${like}::text IS NULL
           OR lot_no ILIKE ${like} OR stone_type ILIKE ${like}
           OR sieve_size ILIKE ${like} OR mm_size ILIKE ${like} OR shape ILIKE ${like}
           OR colour ILIKE ${like} OR clarity ILIKE ${like})
    ORDER BY balance DESC
    LIMIT ${opts.limit ?? 300}`;
  return rows.map((r: any) => ({
    lotId: r.lot_id, lotNo: r.lot_no, stoneType: r.stone_type, shape: r.shape,
    sieveSize: r.sieve_size, mmSize: r.mm_size, colour: r.colour, clarity: r.clarity,
    costRate: Number(r.cost_rate), balance: Number(r.balance), exposure: Number(r.exposure),
    value: Number(r.balance) * Number(r.cost_rate),
  }));
}

/**
 * Goods held on supplier memos, grouped supplier -> spec.
 *
 * `outstanding` is what you still owe the supplier an answer on: neither
 * returned nor billed. `inVault` is how much of it is still here -- the rest
 * went straight out to a client, which is the normal back-to-back deal.
 */
export async function getMemoStock(opts: { search?: string } = {}): Promise<MemoStock[]> {
  const like = opts.search ? `%${opts.search}%` : null;
  const rows = await sql`
    SELECT s.party_id, s.party_name, l.unit_key,
           MAX(s.stone_type) AS stone_type, MAX(s.shape) AS shape,
           spec_sieve(MAX(s.sieve_size)) AS sieve_size, spec_mm(MAX(s.mm_size)) AS mm_size,
           MAX(l.colour) AS colour, MAX(l.clarity) AS clarity,
           SUM(s.outstanding)                                   AS outstanding,
           SUM(b.balance)                                       AS in_vault,
           SUM(s.outstanding * s.rate) / NULLIF(SUM(s.outstanding), 0) AS rate,
           MIN(s.due_on)                                        AS due_on,
           bool_or(s.overdue)                                   AS overdue,
           array_agg(DISTINCT s.memo_no)                        AS memo_nos
    FROM memo_line_status s
    JOIN lots         l ON l.id = s.lot_id
    JOIN lot_balances b ON b.lot_id = s.lot_id
    WHERE s.direction = 'in' AND s.line_status = 'open'
      AND (${like}::text IS NULL
           OR s.party_name ILIKE ${like} OR s.memo_no ILIKE ${like}
           OR s.sieve_size ILIKE ${like} OR s.mm_size ILIKE ${like} OR s.shape ILIKE ${like}
           OR l.colour ILIKE ${like} OR l.clarity ILIKE ${like})
    GROUP BY s.party_id, s.party_name, l.unit_key
    HAVING SUM(s.outstanding) > 0.0005
    ORDER BY bool_or(s.overdue) DESC, MIN(s.due_on), SUM(s.outstanding) DESC`;
  return rows.map((r: any) => ({
    partyId: r.party_id, partyName: r.party_name, unitKey: r.unit_key,
    stoneType: r.stone_type, shape: r.shape, sieveSize: r.sieve_size, mmSize: r.mm_size,
    colour: r.colour, clarity: r.clarity,
    outstanding: Number(r.outstanding), inVault: Number(r.in_vault), rate: Number(r.rate ?? 0),
    dueOn: r.due_on, overdue: !!r.overdue, memoNos: r.memo_nos ?? [],
  }));
}

/** Lots with carats actually available to issue on a memo, owned or held. */
export async function getIssuableLots() {
  const rows = await sql`
    SELECT lot_id, lot_no, stone_type, shape, sieve_size, mm_size, source,
           balance, COALESCE(cost_rate,0) AS cost_rate
    FROM lot_balances WHERE balance > 0.0005
    ORDER BY balance DESC LIMIT 500`;
  return rows.map((r: any) => ({
    lotId: r.lot_id, lotNo: r.lot_no, stoneType: r.stone_type, shape: r.shape,
    sieveSize: r.sieve_size, mmSize: r.mm_size, onMemo: r.source === 'memo_in',
    balance: Number(r.balance), costRate: Number(r.cost_rate),
  }));
}

export async function getStockTotals() {
  const [r] = await sql`
    SELECT COALESCE(SUM(balance)  FILTER (WHERE source <> 'memo_in'), 0) AS owned_carats,
           COALESCE(SUM(balance)  FILTER (WHERE source =  'memo_in'), 0) AS memo_carats,
           COALESCE(SUM(exposure), 0)                                    AS exposure,
           COALESCE(SUM(balance * COALESCE(cost_rate,0))
                    FILTER (WHERE source <> 'memo_in'), 0)               AS value,
           count(*) FILTER (WHERE source <> 'memo_in' AND balance > 0.0005)::int AS units
    FROM lot_balances`;
  return {
    carats: Number(r.owned_carats), memoCarats: Number(r.memo_carats),
    exposure: Number(r.exposure), value: Number(r.value), units: r.units as number,
  };
}
