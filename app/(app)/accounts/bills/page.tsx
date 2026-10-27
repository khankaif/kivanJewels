import Link from 'next/link';
import { Figure } from '@/components/layout/stat';
import { PageHeader } from '@/components/layout/page-header';
import { AccountsNav } from '@/features/accounts/components/accounts-nav';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FilterBar, type FieldDef } from '@/components/layout/filter-bar';
import { BILL_SORTS, getBills, type BillSort } from '@/features/accounts/money';
import { SortHead } from '@/components/layout/sort-head';
import { parseSort } from '@/lib/sort';
import { getPartyOptions } from '@/features/parties/queries';
import { getOwnedUnits } from '@/features/stock/queries';
import { getDiamondPicklists, getSieveShapes } from '@/features/masters/diamonds/queries';
import { AddBillSheet } from '@/features/accounts/components/add-bill-sheet';
import { PaymentDialog } from '@/features/accounts/components/payment-dialog';
import { inr, specLabel, day } from '@/lib/format';

export const dynamic = 'force-dynamic';

const VIEWS: { label: string; params: Record<string, string> }[] = [
  { label: 'All bills', params: {} },
  { label: 'To collect', params: { direction: 'sale', status: 'unpaid' } },
  { label: 'To pay', params: { direction: 'purchase', status: 'unpaid' } },
  { label: 'Overdue', params: { status: 'overdue' } },
];

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

  const [parties, clients, suppliers, units, picklists, sieveShapes] = await Promise.all([
    getPartyOptions(), getPartyOptions('client'), getPartyOptions('supplier'),
    getOwnedUnits({ limit: 300 }), getDiamondPicklists(), getSieveShapes(),
  ]);
  const sort = parseSort(sp.sort, BILL_SORTS, { col: 'date', dir: 'desc' });
  const bills = await getBills({
    sort,
    partyId: sp.party, from: sp.from, to: sp.to, q: sp.q,
    limit: perPage, offset: (page - 1) * perPage,
    direction: sp.direction === 'purchase' ? 'purchase' : sp.direction === 'sale' ? 'sale' : undefined,
    status: (['unpaid', 'paid', 'overdue', 'all'].includes(sp.status ?? '') ? sp.status : 'all') as
      'all' | 'unpaid' | 'paid' | 'overdue',
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
      { value: 'overdue', label: 'Overdue only' },
      { value: 'paid', label: 'Settled only' },
    ] },
    partyField, ...dateFields,
    { type: 'checkbox', name: 'named', label: 'Numbered bills only', checked: sp.named === '1' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        detail={`${total.toLocaleString('en-IN')} bills`}
        title="Accounts"
        actions={
          <AddBillSheet
            clients={clients} suppliers={suppliers}
            units={units.map((u) => ({
              lotId: u.lotId, lotNo: u.lotNo, balance: u.balance,
              label: specLabel(u) === '—' ? u.lotNo : specLabel(u),
            }))}
            picklists={picklists} sieveShapes={sieveShapes}
            defaultOpen={sp.new === '1'}
          />
        }
        tabs={<AccountsNav />}
      />

      {/* Saved views: the four questions this page is opened to answer. */}
      <nav className="flex flex-wrap gap-1">
        {VIEWS.map((v) => {
          const active = Object.entries(v.params).every(([k, val]) => (sp[k] ?? '') === val)
            && ['direction', 'status'].every((k) => (sp[k] ?? '') === (v.params[k] ?? ''));
          return (
            <Button
              key={v.label} size="xs" variant={active ? 'secondary' : 'ghost'} aria-current={active ? 'true' : undefined}
              nativeButton={false} render={<Link href={`/accounts/bills?${new URLSearchParams(v.params)}`} />}
            >
              {v.label}
            </Button>
          );
        })}
      </nav>

      <FilterBar exportHref="/api/export?view=bills" fields={fields} />

      <Card>
        <CardContent className="space-y-4">

          <div className="flex flex-wrap gap-6 border-y py-3 text-sm">
            <Figure label="Bills" value={total.toLocaleString('en-IN')} />
            <Figure label="Gross" value={inr(bills.totals.gross)} />
            <Figure label="Settled" value={inr(bills.totals.paid)} />
            <Figure label="Outstanding" value={inr(bills.totals.balance)} />
          </div>

          <div className="overflow-x-auto">
            <BillTable rows={bills.rows} sort={sort} sp={sp} />
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page} of {pages}</span>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  {page > 1 && (
                    <PaginationItem>
                      <Button variant="ghost" nativeButton={false} render={<Link href={qs({ page: String(page - 1) })} />}>
                        <ChevronLeft data-icon="inline-start" /> Previous
                      </Button>
                    </PaginationItem>
                  )}
                  {page < pages && (
                    <PaginationItem>
                      <Button variant="ghost" nativeButton={false} render={<Link href={qs({ page: String(page + 1) })} />}>
                        Next <ChevronRight data-icon="inline-end" />
                      </Button>
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BillTable({ rows, sort, sp }: {
  rows: NonNullable<Awaited<ReturnType<typeof getBills>>>['rows'];
  sort: BillSort; sp: Record<string, string | undefined>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bill no.</TableHead>
          <SortHead col="date" label="Date" sort={sort} sp={sp} path="/accounts/bills" first="desc" />
          <SortHead col="party" label="Party" sort={sort} sp={sp} path="/accounts/bills" />
          <TableHead>Type</TableHead>
          <SortHead col="amount" label="Amount" sort={sort} sp={sp} path="/accounts/bills" first="desc" className="text-right" />
          <SortHead col="balance" label="Balance" sort={sort} sp={sp} path="/accounts/bills" first="desc" className="text-right" />
          <SortHead col="due" label="Due" sort={sort} sp={sp} path="/accounts/bills" />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((b) => (
          <TableRow key={`${b.direction}:${b.billKey}`}>
            <TableCell>
              <Link
                href={`/accounts/bills/${encodeURIComponent(b.billKey)}?direction=${b.direction}`}
                className="font-mono text-xs hover:underline"
              >
                {b.billNo ?? (b.isCash ? 'Cash' : 'Unnumbered')}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{day(b.billedOn)}</TableCell>
            <TableCell>
              <Link href={`/parties/${b.partyId}`} className="font-medium hover:underline">
                {b.partyName}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{b.direction === 'sale' ? 'Sale' : 'Purchase'}</TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">{inr(b.gross)}</TableCell>
            <TableCell
              className={`text-right tabular-nums font-semibold ${
                b.balance > 0.005 ? '' : 'text-positive'
              }`}
            >
              {b.balance > 0.005 ? inr(b.balance) : 'Settled'}
            </TableCell>
            {/* One column says when it was due and, if it matters, by how much it is late. */}
            <TableCell className={b.status === 'overdue' ? 'text-negative' : 'text-muted-foreground'}>
              {b.balance > 0.005 ? day(b.dueOn) : '—'}
              {b.status === 'overdue' && b.daysOverdue ? (
                <span className="block text-xs">{b.daysOverdue} days late</span>
              ) : null}
            </TableCell>
            <TableCell className="text-right">
              {b.balance > 0.005 && (
                <PaymentDialog
                  partyId={b.partyId} partyName={b.partyName}
                  direction={b.direction === 'sale' ? 'in' : 'out'}
                  billNo={b.billNo} outstanding={b.balance}
                  label={b.direction === 'sale' ? 'Receive' : 'Pay'} size="sm" variant="outline"
                />
              )}
            </TableCell>
          </TableRow>
        ))}
        {!rows.length && <Empty cols={8} what="No bills match these filters." />}
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
