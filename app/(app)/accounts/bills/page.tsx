import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FilterBar } from '@/components/layout/filter-bar';
import { getBills } from '@/features/bills/queries';
import { getPartyOptions } from '@/features/parties/queries';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE = 100;

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const direction = (sp.direction === 'purchase' ? 'purchase' : sp.direction === 'sale' ? 'sale' : undefined);
  const status = (['unpaid', 'paid', 'all'].includes(sp.status ?? '') ? sp.status : 'all') as 'all' | 'unpaid' | 'paid';

  const [{ rows, total, totals }, parties] = await Promise.all([
    getBills({
      direction, status, partyId: sp.party, from: sp.from, to: sp.to, q: sp.q,
      namedOnly: sp.named === '1', limit: PAGE, offset: (page - 1) * PAGE,
    }),
    getPartyOptions(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams(
      Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Every invoice as a document: what you billed, to whom, when, and what is still unpaid.
      </p>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <FilterBar
            exportHref="/api/export?view=bills"
            fields={[
              { type: 'text', name: 'q', label: 'Search', placeholder: 'Bill no. or party', value: sp.q },
              { type: 'select', name: 'direction', label: 'Type', value: sp.direction, options: [
                { value: '', label: 'Sales & purchases' },
                { value: 'sale', label: 'Sales (I billed)' },
                { value: 'purchase', label: 'Purchases (billed to me)' },
              ] },
              { type: 'select', name: 'status', label: 'Status', value: sp.status, options: [
                { value: 'all', label: 'All' },
                { value: 'unpaid', label: 'Unpaid only' },
                { value: 'paid', label: 'Settled only' },
              ] },
              { type: 'select', name: 'party', label: 'Party', value: sp.party, options: [
                { value: '', label: 'All parties' },
                ...parties.map((p) => ({ value: p.id, label: p.name })),
              ] },
              { type: 'date', name: 'from', label: 'From', value: sp.from },
              { type: 'date', name: 'to', label: 'To', value: sp.to },
              { type: 'checkbox', name: 'named', label: 'Numbered bills only', checked: sp.named === '1' },
            ]}
          />

          <div className="flex flex-wrap gap-6 border-y py-3 text-sm">
            <Sum label="Bills" value={total.toLocaleString('en-IN')} />
            <Sum label="Gross" value={inr(totals.gross)} />
            <Sum label="Settled" value={inr(totals.paid)} />
            <Sum label="Outstanding" value={inr(totals.balance)} tone="text-warning" />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill no.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Settled</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={`${b.direction}:${b.billKey}`}>
                    <TableCell>
                      <Link
                        href={`/accounts/bills/${encodeURIComponent(b.billKey)}?direction=${b.direction}`}
                        className="font-mono text-xs underline underline-offset-4"
                      >
                        {b.billNo ?? (b.isCash ? 'Cash' : 'Unnumbered')}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{b.billedOn ?? '—'}</TableCell>
                    <TableCell>{b.partyName}</TableCell>
                    <TableCell>
                      <Badge variant={b.direction === 'sale' ? 'default' : 'outline'}>
                        {b.direction === 'sale' ? 'sale' : 'purchase'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.lines}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(b.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {inr(b.paid)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        b.balance > 0.005 ? 'text-warning' : 'text-positive'
                      }`}
                    >
                      {b.balance > 0.005 ? inr(b.balance) : 'settled'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {b.balance > 0.005 && b.ageDays !== null ? `${b.ageDays}d` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      No bills match these filters.
                    </TableCell>
                  </TableRow>
                )}
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

function Sum({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-bold tabular-nums ${tone ?? ''}`}>{value}</div>
    </div>
  );
}
