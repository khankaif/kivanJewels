import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getOutwardMemos, getParties } from '@/features/memos/queries';
import { getIssuableLots } from '@/features/stock/queries';
import { IssueMemoDialog } from '@/features/memos/components/issue-memo-dialog';
import { SettleLineDialog } from '@/features/memos/components/settle-line-dialog';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MemosPage() {
  const [memos, lots, parties] = await Promise.all([
    getOutwardMemos(), getIssuableLots(), getParties(),
  ]);

  const open = memos.filter((m) => m.status === 'open');
  const exposure = open.reduce((s, m) => s + m.outstanding, 0);
  const overdue = open.filter((m) => m.overdue).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outward memos</h1>
          <p className="text-sm text-muted-foreground">
            {open.length} open · {ct(exposure)} with clients
            {overdue > 0 && <span className="text-red-600"> · {overdue} overdue</span>}
          </p>
        </div>
        <IssueMemoDialog lots={lots} parties={parties} />
      </div>

      {!memos.length && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No memos yet. Issue one to move carats out on approval.
          </CardContent>
        </Card>
      )}

      {memos.map((m) => (
        <Card key={m.memoId} className={m.overdue ? 'border-red-300' : undefined}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 font-mono text-base">
                  {m.memoNo}
                  {m.status === 'closed' ? (
                    <Badge variant="secondary">closed</Badge>
                  ) : m.overdue ? (
                    <Badge variant="destructive">overdue</Badge>
                  ) : (
                    <Badge>open</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {m.partyName} · issued {m.issuedOn}
                  {m.dueOn && ` · due ${m.dueOn}`}
                </CardDescription>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold tabular-nums">{inr(m.value)}</div>
                <div className="text-muted-foreground tabular-nums">
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
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.lines.map((l) => (
                  <TableRow key={l.lineId}>
                    <TableCell>
                      <span className="font-mono text-xs">{l.lotNo}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {l.stoneType} {l.sieveSize ?? ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ct(l.carats)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.returned > 0 ? ct(l.returned) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.billed > 0 ? ct(l.billed) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {l.outstanding > 0.0005 ? ct(l.outstanding) : <Badge variant="secondary">settled</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{inr(l.rate)}</TableCell>
                    <TableCell className="text-right">
                      {l.outstanding > 0.0005 && (
                        <div className="flex justify-end gap-2">
                          <SettleLineDialog
                            lineId={l.lineId} lotNo={l.lotNo}
                            outstanding={l.outstanding} rate={l.rate} action="return"
                          />
                          <SettleLineDialog
                            lineId={l.lineId} lotNo={l.lotNo}
                            outstanding={l.outstanding} rate={l.rate} action="bill"
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
