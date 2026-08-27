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

export type Segment = { label: string; revenue: number; cost: number; profit: number; margin: number };

/**
 * P&L split by business, because the two cannot be blended honestly.
 *
 * COGS is the cost of lots actually SOLD, not everything purchased -- unsold
 * inventory (the kaivan_stock opening lots) belongs on the balance sheet, not
 * in cost of sales.
 *
 * Caveat on the jewellery line: its cost comes from the source "Product
 * Costing" column, which bundles metal, labour AND Rs 2,63,937 of diamonds.
 * Where those diamonds were sourced internally they are also counted in the
 * diamond segment, so total profit is understated by up to that amount. The
 * source workbook records the same stones on two sheets with no key linking
 * them, so this cannot be resolved automatically -- see docs plan, open items.
 */
export async function getSegments(): Promise<Segment[]> {
  const [r] = await sql`
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM ledger
        WHERE kind='sale_invoice' AND ref_type IN ('diamond_hisab','memo_line'))  AS dia_rev,
      (SELECT COALESCE(SUM(p.amount),0) FROM movements p
        WHERE p.kind='purchase'
          AND EXISTS (SELECT 1 FROM movements s
                      WHERE s.lot_id = p.lot_id AND s.kind = 'sale'))             AS dia_cost,
      (SELECT COALESCE(SUM(amount),0) FROM ledger
        WHERE kind='sale_invoice' AND ref_type='jewellery')                       AS jew_rev,
      (SELECT COALESCE(SUM(product_cost),0) FROM jewellery_orders)                AS jew_cost`;

  const mk = (label: string, revenue: number, cost: number): Segment => ({
    label, revenue, cost, profit: revenue - cost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
  });
  return [
    mk('Diamond trading', Number(r.dia_rev), Number(r.dia_cost)),
    mk('Jewellery', Number(r.jew_rev), Number(r.jew_cost)),
  ];
}
