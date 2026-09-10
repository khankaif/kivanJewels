import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { MemoStock } from '../queries';
import { inr, ct, specLabel } from '@/lib/format';



/** What is physically here but still the supplier's, summed by supplier and spec. */
export function MemoTable({ rows }: { rows: MemoStock[] }) {
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
              <TableHead>Sieve / MM</TableHead>
              <TableHead>Colour / Clarity</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">To settle</TableHead>
              <TableHead className="text-right">Still here</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={`${m.partyId}-${m.unitKey}`}>
                <TableCell className="font-medium">
                  <Link href={`/parties/${m.partyId}`} className="underline underline-offset-4">
                    {m.partyName}
                  </Link>
                </TableCell>
                <TableCell>{specLabel(m)}</TableCell>
                <TableCell className="text-sm">
                  {[m.colour, m.clarity].filter(Boolean).join(' · ') || '—'}
                </TableCell>
                <TableCell>
                  <span className={m.overdue ? 'font-medium text-negative' : 'text-muted-foreground'}>
                    {m.overdue ? 'Overdue' : m.inVault > 0.0005 ? 'In vault' : 'With client'}
                  </span>
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
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Nothing held on a supplier memo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
