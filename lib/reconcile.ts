import { sql } from '@/db/client';

/**
 * Asserts the imported database reproduces the source workbook.
 *
 * Tolerances are justified, not padded:
 *  - Carats are exact (numeric(10,3) matches source precision).
 *  - Money totals allow Rs 1. 125 source rows carry more than 2 decimal places;
 *    the workbook sums them unrounded while numeric(14,2) rounds each row to
 *    paise, so round-then-sum differs from sum-then-round by ~10 paise overall.
 *    Widening this to hide a real gap defeats the check.
 */
export type Check = { label: string; got: number; want: number; tol: number; ok: boolean };

const one = async (label: string, want: number, tol: number, rows: Promise<any[]>): Promise<Check> => {
  const got = Number((await rows)[0].t);
  return { label, got, want, tol, ok: Math.abs(got - want) <= tol };
};

export async function checkReconciliation(): Promise<Check[]> {
  return Promise.all([
    one('DH purchase amount', 15920488.26, 1, sql`
      SELECT COALESCE(SUM(amount),0) t FROM movements
      WHERE kind='purchase' AND ref_type='diamond_hisab'`),
    one('DH sale amount (ledger)', 18099078.81, 1, sql`
      SELECT COALESCE(SUM(amount),0) t FROM ledger
      WHERE ref_type='diamond_hisab' AND kind='sale_invoice'`),
    one('DH carats in', 1416.168, 0.0005, sql`
      SELECT COALESCE(SUM(carats),0) t FROM movements
      WHERE carats>0 AND ref_type='diamond_hisab'`),
    one('KS carats in', 48.810, 0.0005, sql`
      SELECT COALESCE(SUM(carats),0) t FROM movements
      WHERE carats>0 AND ref_type='kaivan_stock'`),
    one('KS consumed', 32.560, 0.0005, sql`
      SELECT COALESCE(-SUM(carats),0) t FROM movements
      WHERE carats<0 AND ref_type='kaivan_stock'`),
    one('DH payable', 701128.02, 1, sql`
      SELECT COALESCE(-SUM(amount),0) t FROM ledger
      WHERE ref_type='diamond_hisab' AND kind IN ('purchase_invoice','payment_out')`),
    one('DH receivable', 1192544.67, 1, sql`
      SELECT COALESCE(SUM(amount),0) t FROM ledger
      WHERE ref_type='diamond_hisab' AND kind IN ('sale_invoice','payment_in')`),
    one('Jewellery receivable', 183604.30, 1, sql`
      SELECT COALESCE(SUM(amount),0) t FROM ledger WHERE ref_type='jewellery'`),
    one('negative lot balances', 0, 0, sql`
      SELECT count(*)::int t FROM lot_balances WHERE balance < -0.0005`),
    one('lots imported', 1993, 0, sql`SELECT count(*)::int t FROM lots`),
    one('jewellery orders', 35, 0, sql`SELECT count(*)::int t FROM jewellery_orders`),
  ]);
}
