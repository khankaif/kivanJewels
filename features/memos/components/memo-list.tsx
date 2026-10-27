import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { WhatsAppButton } from '@/components/forms/whatsapp-button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SettleLineDialog } from './settle-line-dialog';
import type { Memo } from '../queries';
import { inr, ct, day } from '@/lib/format';

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
        <Card key={m.memoId}>
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 font-mono text-base">
                  {m.memoNo}
                  {m.status === 'closed'
                    ? <Badge variant="secondary">Complete</Badge>
                    : m.overdue && <Badge variant="destructive">Overdue</Badge>}
                </CardTitle>
                <CardDescription>
                  {m.partyName} · {day(m.issuedOn)}
                  {m.dueOn && ` · due ${day(m.dueOn)}`}
                  {m.agent && ` · by ${m.agent}`}
                </CardDescription>
              </div>
              <div className="flex items-start gap-2">
              <Button
                variant="ghost" size="sm" className="text-muted-foreground" nativeButton={false}
                render={<a href={`/print/memo/${m.memoId}`} target="_blank" rel="noreferrer" />}
              >
                <Printer data-icon="inline-start" /> Print
              </Button>
              {direction === 'out' && m.status !== 'closed' && m.outstanding > 0.0005 && (
                <WhatsAppButton
                  phone={m.partyPhone}
                  text={`Hi ${m.partyName}, memo ${m.memoNo}: ${ct(m.outstanding)} is still with you`
                    + `${m.dueOn ? `, due back ${day(m.dueOn)}` : ''}. Please return it or confirm the bill. Thank you.`}
                />
              )}
              <div className="text-right text-sm">
                <div className="font-semibold tabular-nums">{inr(m.value)}</div>
                <div className="tabular-nums text-muted-foreground">
                  {ct(m.outstanding)} outstanding of {ct(m.carats)}
                </div>
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
                  <TableHead className="text-right">Next action</TableHead>
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
