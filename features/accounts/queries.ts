import { sql } from '@/db/client';

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

export type Segment = {
  label: string; revenue: number; cost: number; uncosted: number;
  profit: number; markup: number; margin: number;
};

/**
 * P&L split by business, following the convention the source workbook uses.
 *
 * Two rules taken from the sheet rather than invented here:
 *
 * 1. Sales with NO cost basis are excluded from profit. Nine rows (the sheet's
 *    first nine, opening stock sold for Rs 4,39,390.63) have a sale but no
 *    purchase, and the sheet deliberately leaves Profit Loss blank rather than
 *    booking them as 100% profit. They are reported separately as `uncosted`
 *    so the money stays visible instead of quietly inflating margin.
 *
 * 2. `markup` is profit over COST -- the sheet's "Profit %" column, 10.92%.
 *    `margin` (profit over revenue) is also returned because it is the more
 *    common convention elsewhere; the UI labels which is which.
 *
 * COGS is the cost of lots actually SOLD, so unsold inventory stays on the
 * balance sheet rather than in cost of sales.
 *
 * Caveat on the jewellery line: its cost comes from "Product Costing", which
 * bundles Rs 2,63,937 of diamonds. Where those were sourced internally they are
 * also counted in the diamond segment, so combined profit is understated by up
 * to that amount. The workbook records the same stones on two sheets with no
 * key linking them.
 */
export async function getSegments(): Promise<Segment[]> {
  const [r] = await sql`
    WITH sold AS (
      SELECT m.lot_id, ABS(m.amount) AS sale_amount,
             EXISTS (SELECT 1 FROM movements x
                     WHERE x.lot_id = m.lot_id AND x.kind = 'purchase') AS costed
      FROM movements m WHERE m.kind = 'sale'
    )
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM ledger
        WHERE kind='sale_invoice' AND ref_type IN ('diamond_hisab','memo_line'))   AS dia_rev,
      (SELECT COALESCE(SUM(sale_amount),0) FROM sold WHERE costed)                 AS dia_costed_rev,
      (SELECT COALESCE(SUM(p.amount),0) FROM movements p
        WHERE p.kind='purchase'
          AND EXISTS (SELECT 1 FROM movements s
                      WHERE s.lot_id = p.lot_id AND s.kind='sale'))                AS dia_cost,
      (SELECT COALESCE(SUM(amount),0) FROM ledger
        WHERE kind='sale_invoice' AND ref_type='jewellery')                        AS jew_rev,
      (SELECT COALESCE(SUM(product_cost),0) FROM jewellery_orders)                 AS jew_cost`;

  const diaRev = Number(r.dia_rev);
  const diaCostedRev = Number(r.dia_costed_rev);
  const diaCost = Number(r.dia_cost);
  const jewRev = Number(r.jew_rev);
  const jewCost = Number(r.jew_cost);

  const mk = (label: string, revenue: number, costedRev: number, cost: number): Segment => {
    const profit = costedRev - cost;
    return {
      label, revenue, cost, uncosted: revenue - costedRev, profit,
      markup: cost > 0 ? (profit / cost) * 100 : 0,
      margin: costedRev > 0 ? (profit / costedRev) * 100 : 0,
    };
  };
  return [
    mk('Diamond trading', diaRev, diaCostedRev, diaCost),
    mk('Jewellery', jewRev, jewRev, jewCost),
  ];
}
