import { auth } from '@/lib/auth/server';
import { sql } from '@/db/client';
import { toCsv } from '@/lib/csv';

/**
 * CSV export for the register views. Excel parity: whatever is on screen can
 * leave as a spreadsheet. The `view` names a whitelisted read-only view --
 * never an arbitrary table or user-supplied SQL.
 */
const VIEWS: Record<string, { sql: string; order: string }> = {
  bills: { sql: 'bills', order: 'billed_on DESC NULLS LAST' },
  ledger_entries: { sql: 'ledger_entries', order: 'dated_on DESC' },
  lot_balances: { sql: 'lot_balances', order: 'balance DESC' },
  size_chart: { sql: 'size_chart', order: 'shape, length_mm, width_mm' },
  memo_line_status: { sql: 'memo_line_status', order: 'issued_on DESC' },
  movement_entries: { sql: 'movement_entries', order: 'moved_on DESC' },
};

export async function GET(req: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const name = url.searchParams.get('view') ?? '';
  const view = VIEWS[name];
  if (!view) return new Response('Unknown view', { status: 400 });

  const rows = (await sql.query(
    `SELECT * FROM ${view.sql} ORDER BY ${view.order} LIMIT 20000`,
  )) as Record<string, unknown>[];

  if (!rows.length) return new Response('', { headers: csvHeaders(name) });
  return new Response(toCsv(Object.keys(rows[0]), rows), { headers: csvHeaders(name) });
}

const csvHeaders = (name: string) => ({
  'content-type': 'text/csv; charset=utf-8',
  'content-disposition': `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
});
