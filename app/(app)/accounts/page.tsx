import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAging, getPartyBalances, getAccountTotals } from '@/features/accounts/queries';
import { getBills } from '@/features/accounts/money';
import { PaymentDialog } from '@/features/accounts/components/payment-dialog';
import { WhatsAppButton } from '@/components/forms/whatsapp-button';
import { inr, day, money } from '@/lib/format';
import { PageHeader } from '@/components/layout/page-header';
import { StatStrip } from '@/components/layout/stat';
import { AccountsNav } from '@/features/accounts/components/accounts-nav';
import { todayIso } from '@/lib/dates';
import { CashMovementCard, parseRange } from '@/features/dashboard/components/cash-movement-card';

export const dynamic = 'force-dynamic';

export default async function AccountsPage({ searchParams }: PageProps<'/accounts'>) {
  const range = parseRange((await searchParams).range);
  const asOf = todayIso();
  const [aging, balances, totals, receivables, payables] = await Promise.all([
    getAging(asOf), getPartyBalances(), getAccountTotals(),
    getBills({ direction: 'sale', status: 'unpaid', limit: 5 }),
    getBills({ direction: 'purchase', status: 'unpaid', limit: 5 }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts"
        tabs={<AccountsNav />}
      />

      <StatStrip items={[
        {
          label: 'To collect', value: money(totals.receivable), title: inr(totals.receivable),
          sub: <Link href="/accounts/bills?direction=sale&status=unpaid" className="hover:text-foreground hover:underline">Unpaid sale bills</Link>,
        },
        {
          label: 'To pay', value: money(totals.payable), title: inr(totals.payable),
          sub: <Link href="/accounts/bills?direction=purchase&status=unpaid" className="hover:text-foreground hover:underline">Unpaid purchase bills</Link>,
        },
      ]} />

      <CashMovementCard range={range} basePath="/accounts" />

      <section>
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <h2 className="text-sm font-medium">Next to settle</h2>
          <Link href="/accounts/bills?status=unpaid" className="text-sm text-muted-foreground hover:text-foreground hover:underline">All unpaid bills</Link>
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
              <CardDescription>Sale invoices by age, as of {day(asOf)}. {aging.length} parties.</CardDescription>
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
                        <Link href={`/parties/${a.partyId}`} className="font-medium hover:underline">
                          {a.partyName}
                        </Link>
                      </TableCell>
                      {/* An empty bucket is a dash, not ₹0.00: the eye should land on the money. */}
                      {[a.d0_30, a.d31_60, a.d61_90].map((v, i) => (
                        <TableCell key={i} className="text-right tabular-nums">
                          {v > 0.005 ? inr(v) : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                      ))}
                      <TableCell className={`text-right tabular-nums ${a.d90_plus > 0.005 ? 'font-medium text-negative' : ''}`}>
                        {a.d90_plus > 0.005 ? inr(a.d90_plus) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{inr(a.total)}</TableCell>
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
                        <Link href={`/parties/${b.partyId}`} className="font-medium hover:underline">
                          {b.partyName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{inr(b.receivable)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(b.payable)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {rows.map((bill) => (
          <div key={`${bill.direction}-${bill.billKey}`} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <Link href={`/parties/${bill.partyId}`} className="block truncate text-sm font-medium hover:underline">{bill.partyName}</Link>
              <div className="text-xs text-muted-foreground">
                {bill.billNo ?? 'Unnumbered'} ·{' '}
                {bill.status === 'overdue'
                  ? <span className="text-negative">{bill.daysOverdue} days overdue</span>
                  : `due ${day(bill.dueOn)}`}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-1 font-medium tabular-nums">{inr(bill.balance)}</span>
              {bill.direction === 'sale' && (
                <WhatsAppButton
                  size="xs" label="" phone={bill.partyPhone}
                  text={`Hi ${bill.partyName}, a reminder that ${bill.billNo ? `bill ${bill.billNo}` : 'our bill'} of ${day(bill.billedOn)} for ${inr(bill.balance)} was due on ${day(bill.dueOn)}. Thank you.`}
                />
              )}
              <PaymentDialog
                partyId={bill.partyId} partyName={bill.partyName}
                direction={bill.direction === 'sale' ? 'in' : 'out'} billNo={bill.billNo}
                outstanding={bill.balance} size="sm" variant="outline"
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
