import Link from 'next/link';
import { StickyNote } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { StatStrip } from '@/components/layout/stat';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRequirement, getDeliverableStock, getRequirementDocuments } from '@/features/sales/queries';
import { FulfilSheet } from '@/features/sales/components/fulfil-sheet';
import { closeRequirementLineAction, setRequirementStatusAction } from '@/features/sales/actions';
import { getPartyOptions } from '@/features/parties/queries';
import { getAgents } from '@/features/memos/queries';
import { ct, inr, specLabel, day } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function RequirementPage({
  params, searchParams,
}: {
  params: Promise<{ requirementNo: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ requirementNo }, sp] = await Promise.all([params, searchParams]);
  const req = await getRequirement(decodeURIComponent(requirementNo));
  if (!req) notFound();

  const [stockByLine, suppliers, agents, docs] = await Promise.all([
    Promise.all(req.lines.map((l) => getDeliverableStock(l.unitKey))),
    getPartyOptions('supplier'),
    getAgents(),
    getRequirementDocuments(req.id),
  ]);
  const openLines = req.lines.filter((line) => line.outstanding > 0.0005 && line.lineStatus === 'open');
  const readyLines = openLines.filter((line) => line.inStock + line.sourcedPending >= line.outstanding - 0.0005);
  const outstanding = openLines.reduce((sum, line) => sum + line.outstanding, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        parent={{ href: '/sales', label: 'Sales' }}
        title={req.requirementNo}
        badges={<Badge variant={req.status === 'open' ? 'outline' : 'secondary'}>{req.status === 'open' ? 'Open' : 'Closed'}</Badge>}
        detail={
          <>
            <Link href={`/parties/${req.partyId}`} className="font-medium text-foreground hover:underline">{req.partyName}</Link>
            {' · '}{day(req.raisedOn)}{req.agent && ` · ${req.agent}`}
          </>
        }
        actions={
          <form action={setRequirementStatusAction}>
            <input type="hidden" name="requirementId" value={req.id} />
            <input type="hidden" name="status" value={req.status === 'open' ? 'closed' : 'open'} />
            <Button type="submit" size="sm" variant="outline">
              {req.status === 'open' ? 'Close requirement' : 'Reopen'}
            </Button>
          </form>
        }
      />
      {req.notes && (
        <Alert>
          <StickyNote />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>{req.notes}</AlertDescription>
        </Alert>
      )}

      <StatStrip items={[
        { label: 'Still to fulfil', value: ct(outstanding) },
        { label: 'Ready to act', value: `${readyLines.length} of ${openLines.length} lines` },
        { label: 'Order value', value: inr(req.lines.reduce((sum, line) => sum + line.wanted * (line.quotedRate ?? 0), 0)) },
      ]} />

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Order lines</span>
        <span className="text-xs text-muted-foreground">Choose fulfil on any open line to send, invoice, or source it.</span>
      </div>
      {req.lines.map((line, i) => {
        const done = line.outstanding <= 0.0005 || line.lineStatus === 'closed';
        const available = line.inStock + line.sourcedPending;
        const ready = available >= line.outstanding - 0.0005;
        return (
          <Card key={line.lineId} className={done ? 'opacity-65' : ready ? 'border-positive/30 shadow-xs' : 'shadow-xs'}>
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Line {i + 1}</div>
                  <CardTitle className="text-base">{specLabel(line)}</CardTitle>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    {ct(line.delivered)} of {ct(line.wanted)} delivered
                    {line.outstanding > 0.0005 && ` · ${ct(line.outstanding)} to go`}
                  </span>
                  {line.quotedRate && <span className="tabular-nums">@ {inr(line.quotedRate)}</span>}
                  {done ? <Badge variant="secondary">{line.lineStatus === 'closed' ? 'closed' : 'fulfilled'}</Badge>
                    : ready ? <Badge>ready to fulfil</Badge>
                      : <Badge variant="outline">needs sourcing</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 pt-4 text-sm">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
                <span>Plan: <span className="font-medium text-foreground">{ct(line.planStock ?? 0)} stock</span>{line.planSource ? ` · ${ct(line.planSource)} source` : ''}</span>
                <span className={line.inStock > 0.0005 ? 'text-positive' : undefined}>
                  Available: <span className="font-medium">{ct(line.inStock)} in stock</span>
                </span>
                {line.sourcedPending > 0.0005 && (
                  <span className="text-warning"><span className="font-medium">{ct(line.sourcedPending)}</span> on supplier approval</span>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                {!done && (
                  <FulfilSheet
                    line={line} stock={stockByLine[i]} suppliers={suppliers} agents={agents}
                    defaultOpen={sp.fulfil === line.lineId}
                  />
                )}
                {line.lineStatus === 'open' && line.outstanding > 0.0005 && (
                  <form action={closeRequirementLineAction}>
                    <input type="hidden" name="lineId" value={line.lineId} />
                    <input type="hidden" name="requirementId" value={req.id} />
                    <Button type="submit" size="sm" variant="ghost">Close unfulfilled</Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paper trail</CardTitle>
          <CardDescription>
            Every document this requirement produced, in the order it happened — memos out and in,
            the invoices they became, and the money that settled them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.length ? docs.map((d, i) => (
            <Item key={`${d.kind}-${d.ref}-${i}`} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  <Badge variant={DOC_TONE[d.kind]}>{DOC_LABEL[d.kind]}</Badge>
                  {d.ref}
                </ItemTitle>
                <ItemDescription>
                  {[d.partyName, day(d.datedOn), d.note].filter(Boolean).join(' · ')}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="tabular-nums">
                {d.carats !== null ? ct(d.carats) : d.amount !== null ? inr(d.amount) : '—'}
              </ItemActions>
            </Item>
          )) : (
            <p className="text-sm text-muted-foreground">
              Nothing issued against this requirement yet — no memo, no invoice, no payment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const DOC_LABEL: Record<string, string> = {
  memo: 'Memo', invoice: 'Invoice', purchase: 'Purchase bill', payment: 'Payment',
};
const DOC_TONE: Record<string, 'default' | 'secondary' | 'outline'> = {
  memo: 'outline', invoice: 'default', purchase: 'secondary', payment: 'secondary',
};
