import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getLotHistory, MOVEMENT_LABEL } from '@/features/stock/register';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LotPage({ params }: { params: Promise<{ lotNo: string }> }) {
  const { lotNo } = await params;
  const history = await getLotHistory(decodeURIComponent(lotNo));
  if (!history.length) notFound();

  const first = history[0];
  const balance = history[history.length - 1].runningBalance;
  const inCt = history.filter((m) => m.isInward).reduce((s, m) => s + m.carats, 0);
  const outCt = history.filter((m) => !m.isInward).reduce((s, m) => s - m.carats, 0);
  // Normal in back-to-back trading: the stones are committed to a client before
  // they are sourced, so by date the lot is briefly short.
  const soldBeforeSourced = history.some((m) => m.runningBalance < -0.0005);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/movements" className="text-sm text-muted-foreground underline underline-offset-4">
          ← All movements
        </Link>
        <h1 className="mt-2 flex items-center gap-3 font-mono text-2xl font-bold tracking-tight">
          {first.lotNo}
          <Badge variant={balance > 0.0005 ? 'default' : 'secondary'}>
            {balance > 0.0005 ? `${ct(balance)} in vault` : 'depleted'}
          </Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {first.stoneType}
          {first.shape ? ` · ${first.shape}` : ''}
          {first.sieveSize ? ` · ${first.sieveSize}` : ''}
          {first.partyName ? ` · from ${first.partyName}` : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total in" value={ct(inCt)} />
        <Stat label="Total out" value={ct(outCt)} />
        <Stat label="Balance" value={ct(balance)} tone={balance > 0.0005 ? 'text-positive' : ''} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Oldest first. {history.length} movements — the complete life of this parcel.
            {soldBeforeSourced && (
              <span className="mt-1 block">
                This lot was <strong>sold before it was sourced</strong>, so the balance is briefly
                negative. That is normal back-to-back trading, not a data error — you commit the
                stones to a client, then buy them in.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Movement</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="tabular-nums">{m.movedOn}</TableCell>
                  <TableCell>
                    <Badge variant={m.isInward ? 'default' : 'outline'}>
                      {MOVEMENT_LABEL[m.kind] ?? m.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.memoNo ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-positive">
                    {m.isInward ? ct(m.carats) : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-warning">
                    {!m.isInward ? ct(-m.carats) : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {ct(m.runningBalance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.rate !== null ? inr(m.rate) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.notes ?? ''}</TableCell>
                </TableRow>
              ))}
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
