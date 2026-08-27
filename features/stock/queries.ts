import { sql } from '@/db/client';

export type StockLot = {
  lotId: string; lotNo: string; stoneType: string; shape: string | null;
  sieveSize: string | null; mmSize: string | null; partyName: string | null;
  costRate: number; balance: number; exposure: number; value: number;
};

export async function getStock(opts: { search?: string; limit?: number } = {}): Promise<StockLot[]> {
  const like = opts.search ? `%${opts.search}%` : null;
  const rows = await sql`
    SELECT lot_id, lot_no, stone_type, shape, sieve_size, mm_size, party_name,
           COALESCE(cost_rate, 0) AS cost_rate, balance, exposure
    FROM lot_balances
    WHERE (balance > 0.0005 OR exposure > 0.0005)
      AND (${like}::text IS NULL
           OR lot_no ILIKE ${like} OR party_name ILIKE ${like}
           OR stone_type ILIKE ${like} OR sieve_size ILIKE ${like} OR shape ILIKE ${like})
    ORDER BY balance DESC
    LIMIT ${opts.limit ?? 300}`;
  return rows.map((r: any) => ({
    lotId: r.lot_id, lotNo: r.lot_no, stoneType: r.stone_type, shape: r.shape,
    sieveSize: r.sieve_size, mmSize: r.mm_size, partyName: r.party_name,
    costRate: Number(r.cost_rate), balance: Number(r.balance), exposure: Number(r.exposure),
    value: Number(r.balance) * Number(r.cost_rate),
  }));
}

/** Lots with carats actually available to issue on a memo. */
export async function getIssuableLots(): Promise<Pick<StockLot, 'lotId' | 'lotNo' | 'stoneType' | 'sieveSize' | 'balance' | 'costRate'>[]> {
  const rows = await sql`
    SELECT lot_id, lot_no, stone_type, sieve_size, balance, COALESCE(cost_rate,0) AS cost_rate
    FROM lot_balances WHERE balance > 0.0005
    ORDER BY balance DESC LIMIT 500`;
  return rows.map((r: any) => ({
    lotId: r.lot_id, lotNo: r.lot_no, stoneType: r.stone_type,
    sieveSize: r.sieve_size, balance: Number(r.balance), costRate: Number(r.cost_rate),
  }));
}

export async function getStockTotals() {
  const [r] = await sql`
    SELECT COALESCE(SUM(balance),0) AS carats,
           COALESCE(SUM(exposure),0) AS exposure,
           COALESCE(SUM(balance * COALESCE(cost_rate,0)),0) AS value,
           count(*) FILTER (WHERE balance > 0.0005)::int AS lots
    FROM lot_balances`;
  return {
    carats: Number(r.carats), exposure: Number(r.exposure),
    value: Number(r.value), lots: r.lots as number,
  };
}
