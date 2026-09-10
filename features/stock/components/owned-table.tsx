import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { StockUnit } from '../queries';
import { inr, ct, specLabel } from '@/lib/format';

/** Sieve and MM are the name of the goods; everything else is description. */


export function OwnedTable({ units }: { units: StockUnit[] }) {
  return (
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
              <TableHead>Status</TableHead>
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
                    {specLabel(u)}
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
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.balance > 0.0005 && <Badge variant="secondary">In vault</Badge>}
                    {u.exposure > 0.0005 && <Badge variant="outline">With client</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{ct(u.balance)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {u.exposure > 0 ? <span className="text-warning">{ct(u.exposure)}</span> : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{inr(u.costRate)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{inr(u.value)}</TableCell>
              </TableRow>
            ))}
            {!units.length && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No stock matches.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
