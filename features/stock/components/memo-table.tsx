import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { MemoStock } from '../queries';
import { inr, ct, day } from '@/lib/format';

/**
 * What is physically here but still the supplier's, summed by supplier and spec.
 * Whether a parcel is in the vault or with a client is the gap between the two
 * carat columns, and lateness is the due date in red -- neither needs a column.
 */
export function MemoTable({ rows }: { rows: MemoStock[] }) {
  const owed = rows.reduce((s, m) => s + m.outstanding, 0);
  const here = rows.reduce((s, m) => s + m.inVault, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Held from suppliers</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Stone</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">To settle</TableHead>
              <TableHead className="text-right">In vault</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => {
              const size = [m.sieveSize, m.mmSize && `${m.mmSize}mm`].filter(Boolean).join(' · ') || '—';
              const grade = [m.shape, m.colour, m.clarity, m.lab && `${m.lab} cert`].filter(Boolean).join(' · ');
              return (
                <TableRow key={`${m.partyId}-${m.unitKey}`}>
                  <TableCell>
                    <Link href={`/parties/${m.partyId}`} className="font-medium hover:underline">
                      {m.partyName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="block font-medium">{size}</span>
                    {grade && <span className="block text-xs text-muted-foreground">{grade}</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.memoNos.join(', ')}</TableCell>
                  <TableCell className={m.overdue ? 'font-medium text-negative' : ''}>
                    {day(m.dueOn)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{ct(m.outstanding)}</TableCell>
                  {/* The gap from "to settle" is goods that went straight out to a client. */}
                  <TableCell className="text-right tabular-nums">{ct(m.inVault)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{inr(m.rate)}</TableCell>
                </TableRow>
              );
            })}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nothing held on a supplier memo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {rows.length > 1 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-medium">Total</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{ct(owed)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{ct(here)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
