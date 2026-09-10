import { sql, type PoolClientLike } from '@/db/client';

export type PartyBalance = {
  partyId: string; partyName: string; receivable: number; payable: number; net: number;
};

export type AgingRow = {
  partyId: string; partyName: string;
  d0_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number;
};

export async function getPartyBalances(): Promise<PartyBalance[]> {
  const rows = await sql`
    SELECT party_id, party_name, receivable, payable, net
    FROM party_balances WHERE net <> 0 ORDER BY ABS(net) DESC`;
  return rows.map((r: any) => ({
    partyId: r.party_id, partyName: r.party_name,
    receivable: Number(r.receivable), payable: Number(r.payable), net: Number(r.net),
  }));
}

export async function getAging(asOf: string): Promise<AgingRow[]> {
  const rows = await sql`SELECT * FROM aging_as_of(${asOf}::date) ORDER BY total DESC`;
  return rows.map((r: any) => ({
    partyId: r.party_id, partyName: r.party_name,
    d0_30: Number(r.d0_30), d31_60: Number(r.d31_60),
    d61_90: Number(r.d61_90), d90_plus: Number(r.d90_plus), total: Number(r.total),
  }));
}

export async function getAccountTotals() {
  const [r] = await sql`
    SELECT COALESCE(SUM(amount) FILTER (WHERE kind IN ('sale_invoice','payment_in')),0)        AS receivable,
           COALESCE(-SUM(amount) FILTER (WHERE kind IN ('purchase_invoice','payment_out')),0)  AS payable
    FROM ledger`;
  return { receivable: Number(r.receivable), payable: Number(r.payable) };
}

/**
 * The whole book's P&L.
 *
 * `cost` counts only lots that have actually SOLD, so unsold inventory stays on
 * the balance sheet rather than in cost of sales.
 *
 * A sale from a lot with no `purchase` movement has no cost to set against it
 * -- opening stock sold before the book starts, and the imported jewellery
 * sales. It is reported as `uncosted` and left out of profit: booking it as
 * 100% profit is the one thing the source workbook refused to do, and this
 * follows that.
 *
 * `markup` is profit over cost, matching the sheet's "Profit %" column.
 */
const PNL_SQL = `
  WITH sold AS (
    SELECT m.lot_id, ABS(m.amount) AS sale_amount,
           EXISTS (SELECT 1 FROM movements x
                   WHERE x.lot_id = m.lot_id AND x.kind = 'purchase') AS costed
    FROM movements m WHERE m.kind = 'sale'
  )
  SELECT
    (SELECT COALESCE(SUM(amount),0) FROM ledger WHERE kind='sale_invoice')       AS revenue,
    (SELECT COALESCE(SUM(sale_amount),0) FROM sold WHERE costed)                 AS costed_revenue,
    (SELECT COALESCE(SUM(p.amount),0) FROM movements p
      WHERE p.kind='purchase'
        AND EXISTS (SELECT 1 FROM movements s
                    WHERE s.lot_id = p.lot_id AND s.kind='sale'))                AS cost`;

/** Pass a transaction client to read uncommitted rows; tests need that. */
export async function getPnl(c?: PoolClientLike) {
  const rows = c ? (await c.query(PNL_SQL)).rows : await sql.query(PNL_SQL);
  const r = rows[0];

  const revenue = Number(r.revenue);
  const costedRevenue = Number(r.costed_revenue);
  const cost = Number(r.cost);
  const profit = costedRevenue - cost;
  return {
    revenue, costedRevenue, cost,
    uncosted: revenue - costedRevenue,
    profit,
    markup: cost > 0 ? (profit / cost) * 100 : 0,
  };
}
