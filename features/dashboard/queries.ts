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

export type CashRange = 'd' | 'w' | 'm';
const RANGE = {
  d: { unit: 'day', step: '1 day', n: 30 },
  w: { unit: 'week', step: '1 week', n: 12 },
  m: { unit: 'month', step: '1 month', n: 12 },
} as const;

/**
 * Money actually received and paid, per day, week or month. Payments only:
 * an invoice is a promise, a payment is cash. Empty periods come back as zero
 * so the chart keeps its rhythm instead of skipping quiet days.
 */
export async function getCashFlow(range: CashRange) {
  const { unit, step, n } = RANGE[range];
  const rows = await sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc(${unit}, CURRENT_DATE) - (${n - 1} * ${step}::interval),
        date_trunc(${unit}, CURRENT_DATE),
        ${step}::interval)::date AS b
    )
    SELECT to_char(b, 'YYYY-MM-DD') AS b,
           COALESCE(SUM(-l.amount) FILTER (WHERE l.kind = 'payment_in'), 0)  AS cash_in,
           COALESCE(SUM(l.amount)  FILTER (WHERE l.kind = 'payment_out'), 0) AS cash_out
    FROM buckets
    LEFT JOIN ledger l
      ON l.kind IN ('payment_in', 'payment_out')
     AND date_trunc(${unit}, l.dated_on)::date = b
    GROUP BY b ORDER BY b`;
  return (rows as any[]).map((r) => ({
    on: r.b as string,
    in: Number(r.cash_in),
    out: Number(r.cash_out),
  }));
}

/**
 * The next fourteen days of money, from due dates rather than history: what
 * clients should pay and what suppliers must be paid, day by day. Money already
 * late is returned separately -- it is not "upcoming", it is a to-do.
 */
export async function getForecast() {
  const [days, [late]] = await Promise.all([
    sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS on,
             COALESCE(SUM(b.balance) FILTER (WHERE b.direction = 'sale'), 0)     AS due_in,
             COALESCE(SUM(b.balance) FILTER (WHERE b.direction = 'purchase'), 0) AS due_out
      FROM generate_series(CURRENT_DATE, CURRENT_DATE + 13, '1 day') d
      LEFT JOIN bills b ON b.due_on::date = d::date AND b.balance > 0.005
      GROUP BY d ORDER BY d`,
    sql`
      SELECT COALESCE(SUM(balance) FILTER (WHERE direction = 'sale'), 0)     AS late_in,
             COALESCE(SUM(balance) FILTER (WHERE direction = 'purchase'), 0) AS late_out
      FROM bills WHERE balance > 0.005 AND due_on::date < CURRENT_DATE`,
  ]);
  return {
    days: (days as any[]).map((r) => ({ on: r.on as string, in: Number(r.due_in), out: Number(r.due_out) })),
    lateIn: Number(late.late_in),
    lateOut: Number(late.late_out),
  };
}

export type TodoKind = 'collect' | 'pay' | 'memo_out' | 'memo_in';
export type Todo = {
  kind: TodoKind; key: string; dueOn: string; daysLate: number;
  partyId: string; partyName: string; partyPhone: string | null;
  doc: string; amount: number; carats: number | null; href: string;
  /** Bills only: enough to record the payment in place. */
  billNo: string | null;
};

/**
 * Everything due within a week or already late, in one list:
 * bills to collect or pay, memos to chase or settle. Each row is one decision.
 */
export async function getInbox(kind: TodoKind | null, limit = 12) {
  const rows = await sql`
    WITH items AS (
      SELECT CASE direction WHEN 'sale' THEN 'collect' ELSE 'pay' END AS kind,
             direction || ':' || bill_key AS key, due_on::date AS due_on, party_id, party_name,
             COALESCE(bill_no, 'Unnumbered') AS doc, bill_no, balance AS amount, NULL::numeric AS carats,
             bill_key AS href
        FROM bills
       WHERE balance > 0.005 AND due_on::date <= CURRENT_DATE + 7
      UNION ALL
      SELECT CASE direction WHEN 'out' THEN 'memo_out' ELSE 'memo_in' END,
             'memo:' || memo_id, due_on::date, party_id, party_name, memo_no, NULL,
             SUM(outstanding * rate), SUM(outstanding),
             CASE direction WHEN 'out' THEN '/sales?tab=memo' ELSE '/stock?tab=memo' END
        FROM memo_line_status
       WHERE memo_status = 'open' AND outstanding > 0.0005 AND due_on::date <= CURRENT_DATE + 7
       GROUP BY memo_id, direction, due_on, party_id, party_name, memo_no
    )
    SELECT i.*, to_char(i.due_on, 'YYYY-MM-DD') AS due,
           GREATEST(CURRENT_DATE - i.due_on, 0) AS days_late,
           (SELECT phone FROM parties p WHERE p.id = i.party_id) AS phone,
           count(*) OVER (PARTITION BY i.kind) AS kind_count
      FROM items i
     -- Due soon first, soonest at the top. Then what is already late: goods out
     -- with clients before money, and the freshest lateness before the oldest --
     -- a bill two years late is a write-off conversation, not this morning's job.
     ORDER BY (i.due_on < CURRENT_DATE),
              CASE WHEN i.due_on >= CURRENT_DATE THEN i.due_on END,
              (i.kind <> 'memo_out'),
              i.due_on DESC, i.amount DESC`;
  const all = rows as any[];
  const counts: Record<TodoKind, number> = { collect: 0, pay: 0, memo_out: 0, memo_in: 0 };
  for (const r of all) counts[r.kind as TodoKind] = Number(r.kind_count);
  const items: Todo[] = all
    .filter((r) => !kind || r.kind === kind || (kind === 'memo_out' && r.kind === 'memo_in'))
    .slice(0, limit)
    .map((r) => ({
      kind: r.kind, key: r.key, dueOn: r.due, daysLate: Number(r.days_late),
      partyId: r.party_id, partyName: r.party_name, partyPhone: r.phone,
      doc: r.doc, billNo: r.bill_no, amount: Number(r.amount),
      carats: r.carats === null ? null : Number(r.carats),
      href: r.kind === 'collect' || r.kind === 'pay'
        ? `/accounts/bills/${encodeURIComponent(r.href)}?direction=${r.kind === 'collect' ? 'sale' : 'purchase'}`
        : r.href,
    }));
  return { items, counts, total: all.length };
}
