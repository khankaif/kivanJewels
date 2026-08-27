import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FilterBar } from '@/components/layout/filter-bar';
import { getMovements, MOVEMENT_LABEL } from '@/features/stock/movements';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE = 200;

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total, inCarats, outCarats } = await getMovements({
    kind: sp.kind, q: sp.q, from: sp.from, to: sp.to,
    direction: sp.direction === 'in' ? 'in' : sp.direction === 'out' ? 'out' : undefined,
    limit: PAGE, offset: (page - 1) * PAGE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (over: Record<string, string>) =>
    `?${new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stone movements</h1>
        <p className="text-sm text-muted-foreground">
          Every carat in and out, with the running balance of its lot. Append-only — corrections are
          new rows, never edits.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <FilterBar
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

          <div className="flex flex-wrap gap-6 border-y py-3 text-sm">
            <Sum label="Movements" value={total.toLocaleString('en-IN')} />
            <Sum label="Carats in" value={ct(inCarats)} tone="text-emerald-600" />
            <Sum label="Carats out" value={ct(outCarats)} tone="text-amber-600" />
            <Sum label="Net" value={ct(inCarats - outCarats)} />
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
                    <TableCell className="tabular-nums">{m.movedOn}</TableCell>
                    <TableCell>
                      <Link
                        href={`/stock/${encodeURIComponent(m.lotNo)}`}
                        className="font-mono text-xs underline underline-offset-4"
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
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {m.isInward ? ct(m.carats) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">
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
              <div className="flex gap-2">
                {page > 1 && <Link className="underline" href={qs({ page: String(page - 1) })}>Previous</Link>}
                {page < pages && <Link className="underline" href={qs({ page: String(page + 1) })}>Next</Link>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Sum({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-bold tabular-nums ${tone ?? ''}`}>{value}</div>
    </div>
  );
}
