import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FilterBar } from '@/components/layout/filter-bar';
import { sql } from '@/db/client';
import { getPartyOptions } from '@/features/parties/queries';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE = 200;
const KIND_LABEL: Record<string, string> = {
  sale_invoice: 'Sale bill', purchase_invoice: 'Purchase bill',
  payment_in: 'Received', payment_out: 'Paid', adjustment: 'Adjustment',
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const kind = sp.kind || null;
  const party = sp.party || null;
  const from = sp.from || null;
  const to = sp.to || null;
  const q = sp.q ? `%${sp.q}%` : null;

  const rows = await sql`
    SELECT * FROM ledger_entries
    WHERE (${kind}::text  IS NULL OR kind = ${kind})
      AND (${party}::uuid IS NULL OR party_id = ${party}::uuid)
      AND (${from}::text  IS NULL OR dated_on >= ${from})
      AND (${to}::text    IS NULL OR dated_on <= ${to})
      AND (${q}::text     IS NULL OR bill_no ILIKE ${q} OR party_name ILIKE ${q} OR ref_id ILIKE ${q})
    ORDER BY dated_on DESC, id
    LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`;

  const [agg] = await sql`
    SELECT count(*)::int AS n,
           COALESCE(SUM(amount) FILTER (WHERE amount > 0),0) AS debit,
           COALESCE(-SUM(amount) FILTER (WHERE amount < 0),0) AS credit
    FROM ledger_entries
    WHERE (${kind}::text  IS NULL OR kind = ${kind})
      AND (${party}::uuid IS NULL OR party_id = ${party}::uuid)
      AND (${from}::text  IS NULL OR dated_on >= ${from})
      AND (${to}::text    IS NULL OR dated_on <= ${to})
      AND (${q}::text     IS NULL OR bill_no ILIKE ${q} OR party_name ILIKE ${q} OR ref_id ILIKE ${q})`;

  const parties = await getPartyOptions();
  const pages = Math.max(1, Math.ceil((agg.n as number) / PAGE));
  const qs = (over: Record<string, string>) =>
    `?${new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Money register</h1>
        <p className="text-sm text-muted-foreground">
          Every rupee that moved, newest first. Append-only: corrections are new rows, never edits.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <FilterBar
            exportHref="/api/export?view=ledger_entries"
            fields={[
              { type: 'text', name: 'q', label: 'Search', placeholder: 'Bill no., party, ref', value: sp.q },
              { type: 'select', name: 'kind', label: 'Entry type', value: sp.kind, options: [
                { value: '', label: 'All entries' },
                { value: 'sale_invoice', label: 'Sale bills' },
                { value: 'purchase_invoice', label: 'Purchase bills' },
                { value: 'payment_in', label: 'Money received' },
                { value: 'payment_out', label: 'Money paid' },
              ] },
              { type: 'select', name: 'party', label: 'Party', value: sp.party, options: [
                { value: '', label: 'All parties' },
                ...parties.map((p) => ({ value: p.id, label: p.name })),
              ] },
              { type: 'date', name: 'from', label: 'From', value: sp.from },
              { type: 'date', name: 'to', label: 'To', value: sp.to },
            ]}
          />

          <div className="flex flex-wrap gap-6 border-y py-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Entries</div>
              <div className="font-bold tabular-nums">{(agg.n as number).toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Debit (owed to me)</div>
              <div className="font-bold tabular-nums text-positive">{inr(agg.debit)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Credit</div>
              <div className="font-bold tabular-nums text-warning">{inr(agg.credit)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Bill / ref</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{r.dated_on}</TableCell>
                    <TableCell>
                      <Link href={`/parties/${r.party_id}`} className="underline underline-offset-4">
                        {r.party_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.kind.endsWith('_invoice') ? 'default' : 'outline'}>
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.bill_no ?? r.ref_id ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.amount) > 0 ? inr(r.amount) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.amount) < 0 ? inr(-Number(r.amount)) : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link className="underline" href={qs({ page: String(page - 1) })}>Previous</Link>}
                {page < pages && <Link className="underline" href={qs({ page: String(page + 1) })}>Next</Link>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
