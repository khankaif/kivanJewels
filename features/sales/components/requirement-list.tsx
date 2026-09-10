import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { Requirement } from '../queries';
import { ct, inr } from '@/lib/format';

const spec = (l: {
  sieveSize: string | null; mmSize: string | null; shape: string | null;
  colour: string | null; clarity: string | null;
}) =>
  [l.sieveSize, l.mmSize && `${l.mmSize}mm`, l.shape, l.colour, l.clarity]
    .filter(Boolean).join(' · ') || '—';

export function RequirementList({
  requirements, emptyLabel,
}: {
  requirements: Requirement[];
  emptyLabel: string;
}) {
  if (!requirements.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No {emptyLabel} requirements. Raise one when a customer asks.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {requirements.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link href={`/sales/${encodeURIComponent(r.requirementNo)}`}
                      className="font-mono underline underline-offset-4">
                  {r.requirementNo}
                </Link>
                <Badge variant={r.status === 'open' ? 'default' : 'secondary'}>{r.status}</Badge>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                <Link href={`/parties/${r.partyId}`} className="underline underline-offset-4">
                  {r.partyName}
                </Link>
                {' · '}{r.raisedOn}{r.agent && ` · ${r.agent}`}
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Spec</TableHead>
                  <TableHead className="text-right">Wanted</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.lines.map((l) => (
                  <TableRow key={l.lineId} className={l.lineStatus === 'closed' ? 'opacity-50' : undefined}>
                    <TableCell>{spec(l)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ct(l.wanted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ct(l.delivered)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {l.outstanding > 0.0005 ? ct(l.outstanding) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.inStock > 0.0005
                        ? <span className="text-positive">{ct(l.inStock)}</span>
                        : l.sourcedPending > 0.0005
                          ? <span className="text-warning">{ct(l.sourcedPending)} sourced</span>
                          : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.quotedRate ? inr(l.quotedRate) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
