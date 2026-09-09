import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getOwnedUnits, getMemoStock, getStockTotals } from '@/features/stock/queries';
import { PurchaseDialog } from '@/features/stock/components/purchase-dialog';
import { getPartyOptions } from '@/features/parties/queries';
import { getDiamondPicklists } from '@/features/masters/diamonds/queries';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Sieve and MM are the name of the goods; everything else is description. */
const spec = (s: { sieveSize: string | null; mmSize: string | null }) =>
  [s.sieveSize, s.mmSize && `${s.mmSize}mm`].filter(Boolean).join(' · ') || '—';

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [units, memo, totals, suppliers, picklists] = await Promise.all([
    getOwnedUnits({ search: q }), getMemoStock({ search: q }), getStockTotals(),
    getPartyOptions('supplier'), getDiamondPicklists(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            What you own is one row per shape, sieve, MM, colour and clarity. What you hold on a
            supplier memo is still theirs, so it stays listed by supplier.
          </p>
        </div>
        <PurchaseDialog
          suppliers={suppliers} shapes={picklists.shape}
          colours={picklists.colour} clarities={picklists.clarity}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="My stock" value={ct(totals.carats)} sub={`${totals.units} units`} />
        <Stat label="Value at cost" value={inr(totals.value)} />
        <Stat label="Held on memo" value={ct(totals.memoCarats)} sub="not yours yet" />
        <Stat label="Out with clients" value={ct(totals.exposure)} sub="on approval" />
      </div>

      <form>
        <Input
          name="q" defaultValue={q ?? ''} className="max-w-sm"
          placeholder="Search sieve, MM, shape, supplier…"
        />
      </form>

      <Tabs defaultValue="owned">
        <TabsList>
          <TabsTrigger value="owned">My stock ({units.length})</TabsTrigger>
          <TabsTrigger value="memo">On memo ({memo.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="owned">
          <Card>
            <CardHeader>
              <CardTitle>Owned units</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sieve / MM</TableHead>
                    <TableHead>Shape</TableHead>
                    <TableHead>Colour / Clarity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">In vault</TableHead>
                    <TableHead className="text-right">With clients</TableHead>
                    <TableHead className="text-right">Avg rate</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((u) => (
                    <TableRow key={u.lotId}>
                      <TableCell>
                        <Link href={`/stock/${encodeURIComponent(u.lotNo)}`}
                              className="font-medium underline underline-offset-4">
                          {spec(u)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{u.shape ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {[u.colour, u.clarity].filter(Boolean).join(' · ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.stoneType.toLowerCase().includes('lab') ? 'secondary' : 'outline'}>
                          {u.stoneType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{ct(u.balance)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u.exposure > 0 ? <span className="text-warning">{ct(u.exposure)}</span> : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{inr(u.costRate)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{inr(u.value)}</TableCell>
                    </TableRow>
                  ))}
                  {!units.length && <Empty cols={8} what="No stock matches." />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memo">
          <Card>
            <CardHeader>
              <CardTitle>Held from suppliers</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Sieve / MM</TableHead>
                    <TableHead>Colour / Clarity</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">To settle</TableHead>
                    <TableHead className="text-right">Still here</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memo.map((m) => (
                    <TableRow key={`${m.partyId}-${m.unitKey}`}>
                      <TableCell className="font-medium">
                        <Link href={`/parties/${m.partyId}`} className="underline underline-offset-4">
                          {m.partyName}
                        </Link>
                      </TableCell>
                      <TableCell>{spec(m)}{m.shape ? ` · ${m.shape}` : ''}</TableCell>
                      <TableCell className="text-sm">
                        {[m.colour, m.clarity].filter(Boolean).join(' · ') || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.memoNos.join(', ')}</TableCell>
                      <TableCell className="text-sm">
                        {m.overdue
                          ? <span className="text-negative">{m.dueOn} · overdue</span>
                          : m.dueOn ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {ct(m.outstanding)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {/* The gap is goods that went straight out to a client. */}
                        {ct(m.inVault)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{inr(m.rate)}</TableCell>
                    </TableRow>
                  ))}
                  {!memo.length && (
                    <Empty cols={8} what="Nothing held on a supplier memo. Settle them from Memos." />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ cols, what }: { cols: number; what: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">{what}</TableCell>
    </TableRow>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
