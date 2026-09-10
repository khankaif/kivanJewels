import { sql } from '@/db/client';
import { getStockTotals } from '@/features/stock/queries';
import { getAccountTotals, getPnl } from '@/features/accounts/queries';

export async function getDashboard() {
  const [stock, money, pnl, memo] = await Promise.all([
    getStockTotals(),
    getAccountTotals(),
    getPnl(),
    sql`SELECT count(*) FILTER (WHERE status='open')::int AS open,
               count(*) FILTER (WHERE status='open' AND due_on < CURRENT_DATE)::int AS overdue
        FROM memos WHERE direction='out'`,
  ]);
  return {
    ...stock,
    ...money,
    ...pnl,
    openMemos: memo[0].open as number,
    overdueMemos: memo[0].overdue as number,
  };
}

export const WORKLIST_HREF = {
  'memo-out-overdue': '/sales?tab=memo',
  'memo-in-overdue': '/stock?tab=memo',
  'memo-out-open': '/sales?tab=memo',
  'memo-in-open': '/stock?tab=memo',
  'sales-open': '/sales',
  'pur-late': '/accounts/bills?direction=purchase&status=unpaid',
  'sale-stale': '/accounts/bills?direction=sale&status=unpaid',
} as const;

export type WorkItem = {
  key: string; label: string; detail: string; count: number; value: number;
  href: string; urgency: 'critical' | 'warning' | 'info';
};

/**
 * What needs acting on, most urgent first.
 *
 * Memos rank above money on purpose: an open memo is stock physically outside
 * your control and not yet billed, so it is both a loss risk and unrecognised
 * revenue. An overdue bill is only money, and the goods are already accounted
 * for. Within memos, overdue beats merely open.
 *
 * "Past terms" uses each party's own credit days rather than a fixed number,
 * matching the sheet's Due = purchase date + terms.
 */
export async function getWorklist(): Promise<WorkItem[]> {
  const [memo] = await sql`
    SELECT
      count(DISTINCT memo_id) FILTER (WHERE overdue AND direction='out')::int      AS out_overdue,
      COALESCE(SUM(outstanding*rate) FILTER (WHERE overdue AND direction='out'),0) AS out_overdue_val,
      count(DISTINCT memo_id) FILTER (WHERE overdue AND direction='in')::int       AS in_overdue,
      COALESCE(SUM(outstanding*rate) FILTER (WHERE overdue AND direction='in'),0)  AS in_overdue_val,
      count(DISTINCT memo_id) FILTER (WHERE NOT overdue AND direction='out')::int  AS out_open,
      COALESCE(SUM(outstanding*rate) FILTER (WHERE NOT overdue AND direction='out'),0) AS out_open_val,
      count(DISTINCT memo_id) FILTER (WHERE NOT overdue AND direction='in')::int   AS in_open,
      COALESCE(SUM(outstanding*rate) FILTER (WHERE NOT overdue AND direction='in'),0)  AS in_open_val
    FROM memo_line_status WHERE memo_status = 'open'`;

  const [sales] = await sql`
    SELECT
      count(DISTINCT requirement_id)::int                                  AS reqs,
      COALESCE(SUM(outstanding * COALESCE(quoted_rate, 0)), 0)             AS value,
      count(*) FILTER (WHERE ready)::int                                   AS lines_ready,
      count(*) FILTER (WHERE NOT ready)::int                               AS lines_short
    FROM (
      SELECT rls.requirement_id, rls.outstanding, rls.quoted_rate,
        (SELECT COALESCE(SUM(b.balance), 0) FROM lot_balances b JOIN lots l ON l.id = b.lot_id
         WHERE l.unit_key = rls.unit_key AND b.balance > 0.0005) >= rls.outstanding AS ready
      FROM requirement_line_status rls
      WHERE rls.requirement_status = 'open' AND rls.line_status = 'open'
        AND rls.outstanding > 0.0005
    ) x`;

  const [money] = await sql`
    SELECT
      (SELECT count(*)::int FROM bills b JOIN parties p ON p.id = b.party_id
        WHERE b.direction='purchase' AND b.balance > 0.005
          AND b.age_days > p.default_terms_days)                                   AS pur_late,
      (SELECT COALESCE(SUM(b.balance),0) FROM bills b JOIN parties p ON p.id = b.party_id
        WHERE b.direction='purchase' AND b.balance > 0.005
          AND b.age_days > p.default_terms_days)                                   AS pur_late_val,
      (SELECT count(*)::int FROM bills
        WHERE direction='sale' AND balance > 0.005 AND age_days > 60)              AS sale_stale,
      (SELECT COALESCE(SUM(balance),0) FROM bills
        WHERE direction='sale' AND balance > 0.005 AND age_days > 60)              AS sale_stale_val`;

  const items: WorkItem[] = [
    { key: 'memo-out-overdue', count: memo.out_overdue, value: Number(memo.out_overdue_val),
      label: 'Memos overdue with clients',
      detail: 'Goods are with a client past the return date. Bill them or get them back.',
      href: WORKLIST_HREF['memo-out-overdue'], urgency: 'critical' },
    { key: 'memo-in-overdue', count: memo.in_overdue, value: Number(memo.in_overdue_val),
      label: 'Supplier memos past due',
      detail: 'You are holding consignment goods past the agreed date. Return or take the bill.',
      href: WORKLIST_HREF['memo-in-overdue'], urgency: 'critical' },
    { key: 'memo-out-open', count: memo.out_open, value: Number(memo.out_open_val),
      label: 'Memos out with clients',
      detail: 'Stock outside your vault, not yet billed.',
      href: WORKLIST_HREF['memo-out-open'], urgency: 'warning' },
    { key: 'memo-in-open', count: memo.in_open, value: Number(memo.in_open_val),
      label: 'Goods held on supplier memo',
      detail: 'In your vault but not yours yet — no payable until billed.',
      href: WORKLIST_HREF['memo-in-open'], urgency: 'info' },
    { key: 'sales-open', count: sales.reqs, value: Number(sales.value),
      label: 'Customer requirements to fulfil',
      detail: `${sales.lines_ready} line${sales.lines_ready === 1 ? '' : 's'} deliverable from stock now, `
        + `${sales.lines_short} need sourcing.`,
      href: WORKLIST_HREF['sales-open'], urgency: 'warning' },
    { key: 'pur-late', count: money.pur_late, value: Number(money.pur_late_val),
      label: 'Supplier bills past terms',
      detail: 'Past each supplier’s own credit days.',
      href: WORKLIST_HREF['pur-late'], urgency: 'warning' },
    { key: 'sale-stale', count: money.sale_stale, value: Number(money.sale_stale_val),
      label: 'Client bills unpaid over 60 days',
      detail: 'Worth chasing.',
      href: WORKLIST_HREF['sale-stale'], urgency: 'warning' },
  ];
  return items.filter((i) => i.count > 0);
}
