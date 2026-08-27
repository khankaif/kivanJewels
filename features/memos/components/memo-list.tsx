import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SettleLineDialog } from './settle-line-dialog';
import type { Memo } from '../queries';
import { inr, ct } from '@/lib/format';

export function MemoList({ memos, direction }: { memos: Memo[]; direction: 'in' | 'out' }) {
  if (!memos.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {direction === 'in'
            ? 'No inward memos. Receive goods from a supplier on approval to start.'
            : 'No outward memos. Issue goods to a client on approval to start.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {memos.map((m) => (
        <Card key={m.memoId} className={m.overdue ? 'border-negative/40' : undefined}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 font-mono text-base">
                  {m.memoNo}
                  {m.status === 'closed' ? (
                    <Badge variant="secondary">settled</Badge>
                  ) : m.overdue ? (
                    <Badge variant="destructive">overdue</Badge>
                  ) : (
                    <Badge>open</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {m.partyName} · {m.issuedOn}
                  {m.dueOn && ` · due ${m.dueOn}`}
                  {m.agent && ` · by ${m.agent}`}
                </CardDescription>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold tabular-nums">{inr(m.value)}</div>
                <div className="tabular-nums text-muted-foreground">
                  {ct(m.outstanding)} outstanding of {ct(m.carats)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">
                    {direction === 'in' ? 'Received' : 'Issued'}
                  </TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Settle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.lines.map((l) => (
                  <TableRow key={l.lineId}>
                    <TableCell>
                      <span className="font-mono text-xs">{l.lotNo}</span>
                      <div className="text-xs text-muted-foreground">
                        {l.stoneType}
                        {l.shape ? ` · ${l.shape}` : ''}
                        {l.sieveSize ? ` · ${l.sieveSize}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ct(l.carats)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.returned > 0 ? ct(l.returned) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.billed > 0 ? (
                        <span title={inr(l.billedAmount)}>{ct(l.billed)}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {l.outstanding > 0.0005 ? ct(l.outstanding) : <Badge variant="secondary">settled</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{inr(l.rate)}</TableCell>
                    <TableCell className="text-right">
                      {l.outstanding > 0.0005 && (
                        <div className="flex justify-end gap-2">
                          <SettleLineDialog
                            lineId={l.lineId} lotNo={l.lotNo} outstanding={l.outstanding}
                            rate={l.rate} action="return" direction={direction}
                          />
                          <SettleLineDialog
                            lineId={l.lineId} lotNo={l.lotNo} outstanding={l.outstanding}
                            rate={l.rate} action="bill" direction={direction}
                          />
                        </div>
                      )}
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
