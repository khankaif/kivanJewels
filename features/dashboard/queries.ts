import { sql } from '@/db/client';
import { getStockTotals } from '@/features/stock/queries';
import { getAccountTotals, getSegments } from '@/features/accounts/queries';

export type SetupStatus = {
  database: boolean; migrations: number; lots: number; movements: number; error?: string;
};

export async function getSetupStatus(): Promise<SetupStatus> {
  try {
    const [{ n: migrations }] = await sql`SELECT count(*)::int AS n FROM _migrations`;
    const [{ n: lots }] = await sql`SELECT count(*)::int AS n FROM lots`;
    const [{ n: movements }] = await sql`SELECT count(*)::int AS n FROM movements`;
    return { database: true, migrations, lots, movements };
  } catch (e) {
    return { database: false, migrations: 0, lots: 0, movements: 0,
      error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getDashboard() {
  const [stock, money, segments, memo] = await Promise.all([
    getStockTotals(),
    getAccountTotals(),
    getSegments(),
    sql`SELECT count(*) FILTER (WHERE status='open')::int AS open,
               count(*) FILTER (WHERE status='open' AND due_on < CURRENT_DATE)::int AS overdue
        FROM memos WHERE direction='out'`,
  ]);
  const revenue = segments.reduce((s, x) => s + x.revenue, 0);
  const cost = segments.reduce((s, x) => s + x.cost, 0);
  const uncosted = segments.reduce((s, x) => s + x.uncosted, 0);
  const profit = segments.reduce((s, x) => s + x.profit, 0);
  return {
    ...stock,
    ...money,
    segments,
    revenue,
    cost,
    uncosted,
    profit,
    // The sheet's "Profit %" is profit over cost. Match it, so the headline
    // number is the one already trusted.
    markup: cost > 0 ? (profit / cost) * 100 : 0,
    openMemos: memo[0].open as number,
    overdueMemos: memo[0].overdue as number,
  };
}
