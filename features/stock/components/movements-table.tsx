import Link from 'next/link';
import { Figure } from '@/components/layout/stat';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FilterBar } from '@/components/layout/filter-bar';
import { MOVEMENT_LABEL, type MovementRow } from '@/features/stock/register';
import { inr, ct, day } from '@/lib/format';

/**
 * Every carat in and out, with the running balance of its lot. Append-only --
 * corrections are new rows, never edits.
 */
export function MovementsTable({
  rows, total, inCarats, outCarats, page, pages, sp,
}: {
  rows: MovementRow[];
  total: number;
  inCarats: number;
  outCarats: number;
  page: number;
  pages: number;
  sp: Record<string, string | undefined>;
}) {
  // Paging stays on this tab: `tab` is seeded before the override, never after.
  const qs = (over: Record<string, string>) =>
    `/stock?${new URLSearchParams(
      Object.entries({ ...sp, tab: 'movements', ...over }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-4">
      <FilterBar
        action="/stock"
        hidden={{ tab: 'movements' }}
        exportHref="/api/export?view=movement_entries"
        fields={[
          { type: 'text', name: 'q', label: 'Search', placeholder: 'Lot, party, sieve, memo', value: sp.q },
          { type: 'select', name: 'kind', label: 'Movement', value: sp.kind, options: [
            { value: '', label: 'All movements' },
            ...Object.entries(MOVEMENT_LABEL).map(([value, label]) => ({ value, label })),
          ] },
          { type: 'select', name: 'direction', label: 'Direction', value: sp.direction, options: [
            { value: '', label: 'In and out' },
            { value: 'in', label: 'Inward only' },
            { value: 'out', label: 'Outward only' },
          ] },
          { type: 'date', name: 'from', label: 'From', value: sp.from },
          { type: 'date', name: 'to', label: 'To', value: sp.to },
        ]}
      />

      <Card>
        <CardContent className="space-y-4">

          <div className="flex flex-wrap gap-6 border-y py-3 text-sm">
            <Figure label="Movements" value={total.toLocaleString('en-IN')} />
            <Figure label="Carats in" value={ct(inCarats)} />
            <Figure label="Carats out" value={ct(outCarats)} />
            <Figure label="Net" value={ct(inCarats - outCarats)} />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Stone</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead>Party / memo</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">Lot balance</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="tabular-nums">{day(m.movedOn)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/stock/${encodeURIComponent(m.lotNo)}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {m.lotNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.stoneType}
                      {m.sieveSize ? ` · ${m.sieveSize}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.isInward ? 'default' : 'outline'}>
                        {MOVEMENT_LABEL[m.kind] ?? m.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.partyName ?? '—'}
                      {m.memoNo && <div className="font-mono text-muted-foreground">{m.memoNo}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.isInward ? ct(m.carats) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {!m.isInward ? ct(-m.carats) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {ct(m.runningBalance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.amount !== null ? inr(m.amount) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      No movements match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page} of {pages}</span>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  {page > 1 && (
                    <PaginationItem>
                      <Button variant="ghost" nativeButton={false} render={<Link href={qs({ page: String(page - 1) })} />}>
                        <ChevronLeft data-icon="inline-start" /> Previous
                      </Button>
                    </PaginationItem>
                  )}
                  {page < pages && (
                    <PaginationItem>
                      <Button variant="ghost" nativeButton={false} render={<Link href={qs({ page: String(page + 1) })} />}>
                        Next <ChevronRight data-icon="inline-end" />
                      </Button>
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
