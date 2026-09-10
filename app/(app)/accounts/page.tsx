import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAging, getPartyBalances, getAccountTotals } from '@/features/accounts/queries';
import { getBills } from '@/features/accounts/money';
import { PaymentDialog } from '@/features/accounts/components/payment-dialog';
import { inr } from '@/lib/format';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const asOf = new Date().toISOString().slice(0, 10);
  const [aging, balances, totals, receivables, payables] = await Promise.all([
    getAging(asOf), getPartyBalances(), getAccountTotals(),
    getBills({ direction: 'sale', status: 'unpaid', limit: 5 }),
    getBills({ direction: 'purchase', status: 'unpaid', limit: 5 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cash control"
        title="Accounts desk"
        description={`See who needs chasing and who needs paying. Aging is calculated as of ${asOf}.`}
        actions={<Link href="/accounts/bills?status=unpaid" className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/85">Open unpaid bills</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="shadow-xs">
          <CardContent className="pt-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">To collect</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-positive">
              {inr(totals.receivable)}
            </div>
            <Link href="/accounts/bills?direction=sale&status=unpaid"
                  className="text-xs text-muted-foreground underline underline-offset-4">
              see unpaid sale bills
            </Link>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="pt-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">To pay</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-warning">
              {inr(totals.payable)}
            </div>
            <Link href="/accounts/bills?direction=purchase&status=unpaid"
                  className="text-xs text-muted-foreground underline underline-offset-4">
              see unpaid purchase bills
            </Link>
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Cash workbench</h2>
            <p className="text-xs text-muted-foreground">The next collections and supplier payments to resolve.</p>
          </div>
          <Link href="/accounts/bills?status=unpaid" className="text-xs font-medium text-primary hover:underline">View every unpaid bill</Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <BillQueue title="Collect from clients" empty="Nothing to collect." rows={receivables.rows} />
          <BillQueue title="Pay suppliers" empty="Nothing to pay." rows={payables.rows} />
        </div>
      </section>

      <Tabs defaultValue="aging">
        <TabsList>
          <TabsTrigger value="aging">Receivables aging</TabsTrigger>
          <TabsTrigger value="parties">Party balances</TabsTrigger>
        </TabsList>

        <TabsContent value="aging">
          <Card>
            <CardHeader>
              <CardTitle>Aging</CardTitle>
              <CardDescription>Sale invoices bucketed by age. {aging.length} parties.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">0–30</TableHead>
                    <TableHead className="text-right">31–60</TableHead>
                    <TableHead className="text-right">61–90</TableHead>
                    <TableHead className="text-right">90+</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.map((a) => (
                    <TableRow key={a.partyId}>
                      <TableCell className="font-medium">
                        <Link href={`/parties/${a.partyId}`} className="underline underline-offset-4">
                          {a.partyName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{inr(a.d0_30)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(a.d31_60)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(a.d61_90)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-negative">
                        {inr(a.d90_plus)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{inr(a.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parties">
          <Card>
            <CardHeader>
              <CardTitle>Party balances</CardTitle>
              <CardDescription>{balances.length} parties with a non-zero balance.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">Receivable</TableHead>
                    <TableHead className="text-right">Payable</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={b.partyId}>
                      <TableCell className="font-medium">
                        <Link href={`/parties/${b.partyId}`} className="underline underline-offset-4">
                          {b.partyName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{inr(b.receivable)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(b.payable)}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-bold ${
                          b.net < 0 ? 'text-warning' : 'text-positive'
                        }`}
                      >
                        {inr(b.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BillQueue({ title, empty, rows }: {
  title: string; empty: string;
  rows: Awaited<ReturnType<typeof getBills>>['rows'];
}) {
  return (
    <Card className="shadow-xs">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y pt-1">
        {rows.map((bill) => (
          <div key={`${bill.direction}-${bill.billKey}`} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <Link href={`/parties/${bill.partyId}`} className="block truncate text-sm font-medium hover:underline">{bill.partyName}</Link>
              <div className="text-xs text-muted-foreground">
                {bill.billNo ?? 'Unnumbered'} · {bill.status === 'overdue' ? `${bill.daysOverdue}d overdue` : `due ${bill.dueOn ?? '—'}`}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={bill.status === 'overdue' ? 'font-semibold tabular-nums text-negative' : 'font-semibold tabular-nums'}>{inr(bill.balance)}</span>
              <PaymentDialog
                partyId={bill.partyId} partyName={bill.partyName}
                direction={bill.direction === 'sale' ? 'in' : 'out'} billNo={bill.billNo}
                outstanding={bill.balance} size="sm"
                label={bill.direction === 'sale' ? 'Receive' : 'Pay'}
              />
            </div>
          </div>
        ))}
        {!rows.length && <div className="py-8 text-center text-sm text-muted-foreground">{empty}</div>}
      </CardContent>
    </Card>
  );
}
