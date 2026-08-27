import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getStock, getStockTotals } from '@/features/stock/queries';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [lots, totals] = await Promise.all([getStock({ search: q }), getStockTotals()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Balance is what is physically in the vault. Carats out on an open memo show as exposure.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="In vault" value={ct(totals.carats)} sub={`${totals.lots} lots`} />
        <Stat label="Vault value at cost" value={inr(totals.value)} />
        <Stat label="Out on memo" value={ct(totals.exposure)} sub="with clients on approval" />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Lots</CardTitle>
            <CardDescription>Showing {lots.length} lots with a balance or exposure.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form className="max-w-xs flex-1">
              <Input name="q" defaultValue={q ?? ''} placeholder="Search lot, party, sieve, shape…" />
            </form>
            <a href="/api/export?view=lot_balances"
               className="text-sm text-muted-foreground underline underline-offset-4">
              Export CSV
            </a>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sieve / MM</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">In vault</TableHead>
                <TableHead className="text-right">On memo</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((l) => (
                <TableRow key={l.lotId}>
                  <TableCell className="font-mono text-xs">{l.lotNo}</TableCell>
                  <TableCell>
                    <Badge variant={l.stoneType.toLowerCase().includes('lab') ? 'secondary' : 'outline'}>
                      {l.stoneType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.sieveSize ?? '—'} {l.mmSize ? `· ${l.mmSize}` : ''}
                  </TableCell>
                  <TableCell>{l.partyName ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{ct(l.balance)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.exposure > 0 ? <span className="text-amber-600">{ct(l.exposure)}</span> : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{inr(l.costRate)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{inr(l.value)}</TableCell>
                </TableRow>
              ))}
              {!lots.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No lots match.
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
