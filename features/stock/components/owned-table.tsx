import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
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
export function OwnedTable({
  units,
  total,
  overallBalance,
  overallExposure,
  overallValue,
  page,
  pages,
  sp,
}: {
  units: StockUnit[];
  total?: number;
  overallBalance?: number;
  overallExposure?: number;
  overallValue?: number;
  page?: number;
  pages?: number;
  sp?: Record<string, string | undefined>;
}) {
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.stoneType, (counts.get(u.stoneType) ?? 0) + 1);
  const usual = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mixed = counts.size > 1;
  const sum = (k: 'balance' | 'exposure' | 'value') => units.reduce((s, u) => s + u[k], 0);

  const totalCount = total ?? units.length;
  const curPage = page ?? 1;

  const qs = (p: number) => {
    const nextSp = new URLSearchParams(
      Object.entries({ ...sp, tab: 'owned', page: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][]
    );
    return `/stock?${nextSp.toString()}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Owned units</CardTitle>
        <CardDescription>
          {totalCount} {totalCount === 1 ? 'unit' : 'units'}
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
              const size = u.sizeId || u.lotNo;
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
          {(totalCount > 1 || units.length > 1) && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">{pages && pages > 1 ? 'Total (all)' : 'Total'}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {ct(overallBalance !== undefined ? overallBalance : sum('balance'))}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {ct(overallExposure !== undefined ? overallExposure : sum('exposure'))}
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums font-semibold">
                  {inr(overallValue !== undefined ? overallValue : sum('value'))}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
      {pages !== undefined && pages > 1 && (
        <CardFooter className="flex items-center justify-between border-t py-3 text-sm">
          <span className="text-muted-foreground">
            Page {curPage} of {pages}
          </span>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              {curPage > 1 && (
                <PaginationItem>
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={qs(curPage - 1)} />}>
                    <ChevronLeft data-icon="inline-start" /> Previous
                  </Button>
                </PaginationItem>
              )}
              <span className="px-2 text-xs text-muted-foreground">
                Page {curPage} of {pages}
              </span>
              {curPage < pages && (
                <PaginationItem>
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={qs(curPage + 1)} />}>
                    Next <ChevronRight data-icon="inline-end" />
                  </Button>
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </CardFooter>
      )}
    </Card>
  );
}
