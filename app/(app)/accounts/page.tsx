import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAging, getPartyBalances, getAccountTotals } from '@/features/accounts/queries';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const asOf = new Date().toISOString().slice(0, 10);
  const [aging, balances, totals] = await Promise.all([
    getAging(asOf), getPartyBalances(), getAccountTotals(),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">One row per party, not per invoice. Aging as of {asOf}.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Receivable</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-positive">
              {inr(totals.receivable)}
            </div>
            <Link href="/accounts/bills?direction=sale&status=unpaid"
                  className="text-xs text-muted-foreground underline underline-offset-4">
              see unpaid sale bills
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Payable</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-warning">
              {inr(totals.payable)}
            </div>
            <Link href="/accounts/bills?direction=purchase&status=unpaid"
                  className="text-xs text-muted-foreground underline underline-offset-4">
              see unpaid purchase bills
            </Link>
          </CardContent>
        </Card>
      </div>

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
