import Link from 'next/link';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { StatStrip } from '@/components/layout/stat';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getBill, getBillLines, getBillTrail } from '@/features/accounts/money';
import { PaymentDialog } from '@/features/accounts/components/payment-dialog';
import { inr, ct, day } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BillPage({
  params, searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ direction?: string }>;
}) {
  const { key } = await params;
  const { direction: dirRaw } = await searchParams;
  const direction = dirRaw === 'purchase' ? 'purchase' : 'sale';
  const billKey = decodeURIComponent(key);

  const [bill, lines, trail] = await Promise.all([
    getBill(billKey, direction), getBillLines(billKey, direction), getBillTrail(billKey, direction),
  ]);
  if (!bill) notFound();

  const items = lines.filter((l) => l.kind.endsWith('_invoice'));
  const payments = lines.filter((l) => l.kind.startsWith('payment'));
  const totalCarats = items.reduce((s, l) => s + (l.carats ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        parent={{ href: '/accounts/bills', label: 'Bills' }}
        title={bill.billNo ?? (bill.isCash ? 'Cash sale' : 'Unnumbered')}
        badges={
          <>
            <Badge variant="outline">{direction === 'sale' ? 'Sale' : 'Purchase'}</Badge>
            {bill.status === 'paid' && <Badge variant="secondary">Settled</Badge>}
            {bill.status === 'overdue' && <Badge variant="destructive">Overdue{bill.daysOverdue ? ` ${bill.daysOverdue}d` : ''}</Badge>}
          </>
        }
        detail={
          <>
            <Link href={`/parties/${bill.partyId}`} className="font-medium text-foreground hover:underline">{bill.partyName}</Link>
            {' · '}{day(bill.billedOn)}{bill.dueOn && ` · due ${day(bill.dueOn)}`}
          </>
        }
        actions={
          <Button
            size="sm" variant="outline" nativeButton={false}
            render={<a href={`/print/bill/${encodeURIComponent(billKey)}?direction=${direction}`} target="_blank" rel="noreferrer" />}
          >
            <Printer data-icon="inline-start" /> Print
          </Button>
        }
      />

      {/* Balance is amount less settled, so it leads and the other two explain it. */}
      <StatStrip items={[
        {
          label: bill.balance > 0.005 ? 'Balance' : 'Settled in full',
          value: inr(bill.balance > 0.005 ? bill.balance : bill.gross),
          tone: bill.balance > 0.005 ? undefined : 'text-positive',
          sub: bill.balance > 0.005 ? `${inr(bill.gross)} billed, ${inr(bill.paid)} settled` : undefined,
        },
        { label: 'Goods', value: totalCarats > 0 ? ct(totalCarats) : `${bill.lines} ${bill.lines === 1 ? 'line' : 'lines'}` },
      ]} />

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>{items.length} {items.length === 1 ? 'line' : 'lines'} on this bill.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Stone</TableHead>
                <TableHead>Sieve</TableHead>
                <TableHead className="text-right">Carats</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="tabular-nums">{day(l.datedOn)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.lotNo ?? l.refId ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {l.stoneType ?? '—'}{l.shape ? ` · ${l.shape}` : ''}
                  </TableCell>
                  <TableCell className="text-xs">{l.sieveSize ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.carats !== null ? ct(l.carats) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.rate !== null ? inr(l.rate) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {inr(Math.abs(l.amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where these goods came from</CardTitle>
          <CardDescription>
            The chain behind this document: the parcel each line came out of, the memo it settled,
            and the requirement it was raised against.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {trail.length ? trail.map((t) => (
            <Item key={t.ledgerId} variant="outline" size="sm">
              <ItemContent>
              <ItemTitle>{t.spec}</ItemTitle>
              <ItemDescription className="flex flex-wrap gap-x-4 gap-y-1">
                {t.lotNo && <span>lot <span className="font-mono">{t.lotNo}</span></span>}
                {t.stoneType && <span>{t.stoneType}</span>}
                {t.memoNo && (
                  <span>
                    from <span className="font-mono">{t.memoNo}</span>
                    {t.memoIssuedOn && ` · ${t.memoDirection === 'out' ? 'issued' : 'received'} ${day(t.memoIssuedOn)}`}
                  </span>
                )}
                {t.requirementNo && (
                  <span>
                    for{' '}
                    <Link href={`/sales/${encodeURIComponent(t.requirementNo)}`} className="font-medium hover:underline">
                      {t.requirementNo}
                    </Link>
                    {t.requirementParty && ` · ${t.requirementParty}`}
                  </span>
                )}
              </ItemDescription>
              </ItemContent>
              <ItemActions className="tabular-nums">{inr(t.amount)}</ItemActions>
            </Item>
          )) : (
            <p className="text-sm text-muted-foreground">
              No chain recorded — this bill predates the linked ledger, or it is a charges-only
              document with no goods behind it.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Settlement</CardTitle>
              <CardDescription>
                {payments.length
                  ? `${payments.length} payment rows.`
                  : direction === 'sale'
                    ? 'Nothing received against this bill yet.'
                    : 'Nothing paid against this bill yet.'}
              </CardDescription>
            </div>
            {bill.balance > 0.005 && bill.billNo && (
              <PaymentDialog
                partyId={bill.partyId}
                partyName={bill.partyName}
                direction={direction === 'sale' ? 'in' : 'out'}
                billNo={bill.billNo}
                outstanding={bill.balance}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums">{day(p.datedOn)}</TableCell>
                  <TableCell>{p.kind === 'payment_in' ? 'Received' : 'Paid out'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.notes ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(Math.abs(p.amount))}</TableCell>
                </TableRow>
              ))}
              {!payments.length && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Unpaid.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
