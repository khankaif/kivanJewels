import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { StockUnit } from '../queries';
import { inr, ct } from '@/lib/format';

/**
 * Sieve and MM are the name of the goods, so they lead; shape, grade and
 * certificate read underneath. The common stone type is said once, in the
 * title; only a parcel that differs from it is marked.
 */
export function OwnedTable({ units }: { units: StockUnit[] }) {
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.stoneType, (counts.get(u.stoneType) ?? 0) + 1);
  const usual = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mixed = counts.size > 1;
  const sum = (k: 'balance' | 'exposure' | 'value') => units.reduce((s, u) => s + u[k], 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Owned units</CardTitle>
        <CardDescription>
          {units.length} {units.length === 1 ? 'unit' : 'units'}
          {usual && (mixed ? `, ${usual} unless marked` : `, all ${usual}`)}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stone</TableHead>
              <TableHead className="text-right">In vault</TableHead>
              <TableHead className="text-right">With clients</TableHead>
              <TableHead className="text-right">Avg rate</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((u) => {
              const size = [u.sieveSize, u.mmSize && `${u.mmSize}mm`].filter(Boolean).join(' · ') || u.lotNo;
              const grade = [u.shape, u.colour, u.clarity, u.lab && `${u.lab} cert`].filter(Boolean).join(' · ');
              return (
                <TableRow key={u.lotId}>
                  <TableCell>
                    <Link href={`/stock/${encodeURIComponent(u.lotNo)}`} className="group block">
                      <span className="block font-medium group-hover:underline">{size}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {grade}
                        {u.stoneType !== usual && <Badge variant="outline" className="h-4 px-1.5">{u.stoneType}</Badge>}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.balance > 0.0005 ? ct(u.balance) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u.exposure > 0.0005 ? <span className="text-warning">{ct(u.exposure)}</span> : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{inr(u.costRate)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{inr(u.value)}</TableCell>
                </TableRow>
              );
            })}
            {!units.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No stock matches.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {units.length > 1 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{ct(sum('balance'))}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{ct(sum('exposure'))}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums font-semibold">{inr(sum('value'))}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
