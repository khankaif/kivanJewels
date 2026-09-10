import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getBill, getBillLines, getBillTrail } from '@/features/accounts/money';
import { PaymentDialog } from '@/features/accounts/components/payment-dialog';
import { inr, ct } from '@/lib/format';

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
    <div className="space-y-6">
      <div>
        <Link href="/accounts/bills" className="text-sm text-muted-foreground underline underline-offset-4">
          ← All bills
        </Link>
        <h1 className="mt-2 flex items-center gap-3 font-mono text-2xl font-bold tracking-tight">
          {bill.billNo ?? (bill.isCash ? 'Cash sale' : 'Unnumbered')}
          <Badge variant={direction === 'sale' ? 'default' : 'outline'}>{direction}</Badge>
          {bill.status === 'paid' && <Badge variant="secondary">settled</Badge>}
          {bill.status === 'overdue' && (
            <Badge variant="destructive">
              {inr(bill.balance)} overdue{bill.daysOverdue ? ` by ${bill.daysOverdue}d` : ''}
            </Badge>
          )}
          {(bill.status === 'due' || bill.status === 'part') && (
            <Badge variant="outline">{inr(bill.balance)} {bill.status === 'part' ? 'left' : 'due'}</Badge>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/parties/${bill.partyId}`} className="underline underline-offset-4">
            {bill.partyName}
          </Link>
          {' · '}{bill.billedOn ?? '—'}
          {bill.dueOn && ` · due ${bill.dueOn}`}
          {bill.ageDays !== null && bill.balance > 0.005 && ` · ${bill.ageDays} days old`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Amount" value={inr(bill.gross)} />
        <Stat label="Settled" value={inr(bill.paid)} />
        <Stat label="Balance" value={inr(bill.balance)} tone={bill.balance > 0.005 ? 'text-warning' : 'text-positive'} />
        <Stat label="Goods" value={totalCarats > 0 ? ct(totalCarats) : `${bill.lines} lines`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>{items.length} lines on this bill.</CardDescription>
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
                  <TableCell className="tabular-nums">{l.datedOn}</TableCell>
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
            <div key={t.ledgerId} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t.spec}</span>
                <span className="tabular-nums">{inr(t.amount)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {t.lotNo && <span>lot <span className="font-mono">{t.lotNo}</span></span>}
                {t.stoneType && <span>{t.stoneType}</span>}
                {t.memoNo && (
                  <span>
                    from <span className="font-mono">{t.memoNo}</span>
                    {t.memoIssuedOn && ` · ${t.memoDirection === 'out' ? 'issued' : 'received'} ${t.memoIssuedOn}`}
                  </span>
                )}
                {t.requirementNo && (
                  <span>
                    for{' '}
                    <Link href={`/sales/${encodeURIComponent(t.requirementNo)}`} className="underline underline-offset-4">
                      {t.requirementNo}
                    </Link>
                    {t.requirementParty && ` · ${t.requirementParty}`}
                  </span>
                )}
              </div>
            </div>
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
                  <TableCell className="tabular-nums">{p.datedOn}</TableCell>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-bold tabular-nums ${tone ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
