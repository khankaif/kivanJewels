import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FilterBar, type FieldDef } from '@/components/layout/filter-bar';
import { getBills } from '@/features/accounts/money';
import { getPartyOptions } from '@/features/parties/queries';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Every invoice as a document: what you billed, to whom, and what is unpaid.
 *
 * The ungrouped view of the same `ledger` rows -- every rupee in date order --
 * was dropped: goods here always move before money, so no payment can exist
 * without a bill to group under, and the per-party statement covers the rest.
 * `/api/export?view=ledger_entries` still hands the flat list to a spreadsheet.
 */
export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const perPage = 100;

  const parties = await getPartyOptions();
  const bills = await getBills({
    partyId: sp.party, from: sp.from, to: sp.to, q: sp.q,
    limit: perPage, offset: (page - 1) * perPage,
    direction: sp.direction === 'purchase' ? 'purchase' : sp.direction === 'sale' ? 'sale' : undefined,
    status: (['unpaid', 'paid', 'all'].includes(sp.status ?? '') ? sp.status : 'all') as 'all' | 'unpaid' | 'paid',
    namedOnly: sp.named === '1',
  });

  const total = bills.total;
  const pages = Math.max(1, Math.ceil(total / perPage));

  const qs = (over: Record<string, string>) =>
    `?${new URLSearchParams(
      Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][])}`;

  const partyField: FieldDef = {
    type: 'select', name: 'party', label: 'Party', value: sp.party,
    options: [{ value: '', label: 'All parties' }, ...parties.map((p) => ({ value: p.id, label: p.name }))],
  };
  const dateFields: FieldDef[] = [
    { type: 'date', name: 'from', label: 'From', value: sp.from },
    { type: 'date', name: 'to', label: 'To', value: sp.to },
  ];

  const fields: FieldDef[] = [
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
    partyField, ...dateFields,
    { type: 'checkbox', name: 'named', label: 'Numbered bills only', checked: sp.named === '1' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Every invoice as a document: what you billed, to whom, when, and what is still unpaid.
      </p>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <FilterBar
            exportHref="/api/export?view=bills"
            fields={fields}
          />

          <div className="flex flex-wrap gap-6 border-y py-3 text-sm">
            <Sum label="Bills" value={total.toLocaleString('en-IN')} />
            <Sum label="Gross" value={inr(bills.totals.gross)} />
            <Sum label="Settled" value={inr(bills.totals.paid)} />
            <Sum label="Outstanding" value={inr(bills.totals.balance)} tone="text-warning" />
          </div>

          <div className="overflow-x-auto">
            <BillTable rows={bills.rows} />
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

function BillTable({ rows }: { rows: NonNullable<Awaited<ReturnType<typeof getBills>>>['rows'] }) {
  return (
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
            <TableCell>
              <Link href={`/parties/${b.partyId}`} className="underline underline-offset-4">
                {b.partyName}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={b.direction === 'sale' ? 'default' : 'outline'}>{b.direction}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{b.lines}</TableCell>
            <TableCell className="text-right tabular-nums">{inr(b.gross)}</TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">{inr(b.paid)}</TableCell>
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
        {!rows.length && <Empty cols={9} what="No bills match these filters." />}
      </TableBody>
    </Table>
  );
}

function Empty({ cols, what }: { cols: number; what: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">{what}</TableCell>
    </TableRow>
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
