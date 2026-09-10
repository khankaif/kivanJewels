import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRequirement, getDeliverableStock, getRequirementDocuments } from '@/features/sales/queries';
import { FulfilSheet } from '@/features/sales/components/fulfil-sheet';
import { closeRequirementLineAction, setRequirementStatusAction } from '@/features/sales/actions';
import { getPartyOptions } from '@/features/parties/queries';
import { getAgents } from '@/features/memos/queries';
import { ct, inr, specLabel } from '@/lib/format';
import { ArrowLeft, CircleAlert, PackageCheck, PackageSearch } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="border-b border-border/80 pb-5">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All customer orders
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Fulfilment workspace</div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="font-mono">{req.requirementNo}</span>
            <Badge variant={req.status === 'open' ? 'default' : 'secondary'}>{req.status}</Badge>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <Link href={`/parties/${req.partyId}`} className="font-medium underline underline-offset-4 hover:text-foreground">{req.partyName}</Link>
              {' · '}{req.raisedOn}{req.agent && ` · ${req.agent}`}
            </p>
          </div>
          <form action={setRequirementStatusAction}>
            <input type="hidden" name="requirementId" value={req.id} />
            <input type="hidden" name="status" value={req.status === 'open' ? 'closed' : 'open'} />
            <Button type="submit" size="sm" variant="outline">
              {req.status === 'open' ? 'Close requirement' : 'Reopen'}
            </Button>
          </form>
        </div>
        {req.notes && <p className="mt-3 rounded-lg bg-muted/55 px-3 py-2 text-sm">{req.notes}</p>}
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Still to fulfil" value={ct(outstanding)} icon={<PackageSearch className="size-4" />} />
        <Metric label="Ready to act" value={`${readyLines.length} of ${openLines.length} lines`} icon={<PackageCheck className="size-4" />} tone="text-positive" />
        <Metric label="Order value" value={inr(req.lines.reduce((sum, line) => sum + line.wanted * (line.quotedRate ?? 0), 0))} icon={<CircleAlert className="size-4" />} />
      </section>

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
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Line {i + 1}</div>
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
            <div
              key={`${d.kind}-${d.ref}-${i}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border p-3 text-sm"
            >
              <Badge variant={DOC_TONE[d.kind]}>{DOC_LABEL[d.kind]}</Badge>
              <span className="font-mono text-xs">{d.ref}</span>
              <span className="text-muted-foreground">{d.partyName}</span>
              <span className="text-xs text-muted-foreground">{d.datedOn}</span>
              {d.note && <span className="text-xs text-muted-foreground">{d.note}</span>}
              <span className="ml-auto tabular-nums">
                {d.carats !== null ? ct(d.carats) : d.amount !== null ? inr(d.amount) : '—'}
              </span>
            </div>
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

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone?: string }) {
  return (
    <Card className="shadow-xs">
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{icon}{label}</div>
        <div className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
