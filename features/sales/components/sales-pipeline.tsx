import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ct, day } from '@/lib/format';
import {
  STAGES, STAGE_LABEL, type AdhocApproval, type PipelineRow, type Stage,
} from '../queries';

const DESCRIPTION: Record<Stage, string> = {
  new: 'Needs a stock decision',
  sourcing: 'Waiting on a supplier',
  ready: 'Can be fulfilled now',
  approval: 'With the customer',
  closed: 'Completed or closed short',
};

/** The verb that goes with each stage, and where it takes you. */
const ACTION: Record<Stage, string> = {
  new: 'Fulfil', sourcing: 'Chase supplier', ready: 'Send to customer',
  approval: 'Settle memo', closed: 'Open',
};

const actionHref = (r: PipelineRow) => {
  const detail = `/sales/${encodeURIComponent(r.requirementNo)}`;
  if (r.stage === 'sourcing') return '/stock?tab=memo';
  if (r.stage === 'approval') return '/sales?tab=memo';
  // Deep-link straight into the line's fulfil drawer, so the board's next
  // action is one click rather than a page to re-read.
  return r.nextLineId ? `${detail}?fulfil=${r.nextLineId}` : detail;
};

/**
 * A sales pipeline is a decision board, derived from the live ledger state.
 *
 * The stage is computed in SQL (`requirement_pipeline`), not here: "on
 * approval" means carats a customer is still holding — net of what came back
 * AND net of what was billed — which is `memo_line_status.outstanding`, not
 * carats that were ever sent.
 */
export function SalesPipeline({
  rows, adhoc,
}: {
  rows: PipelineRow[]; adhoc: AdhocApproval[];
}) {
  const buckets = new Map<Stage, PipelineRow[]>(STAGES.map((s) => [s, []]));
  rows.forEach((r) => buckets.get(r.stage)!.push(r));

  const count = (s: Stage) => buckets.get(s)!.length + (s === 'approval' ? adhoc.length : 0);
  // An empty stage keeps its place in the flow but gives its width to the busy ones.
  const columns = STAGES.map((s) => (count(s) ? 'minmax(0,1fr)' : 'minmax(9rem,0.45fr)')).join(' ');

  return (
    <div
      className="grid gap-3 xl:[grid-template-columns:var(--cols)]"
      style={{ '--cols': columns } as React.CSSProperties}
    >
      {STAGES.map((stage) => {
        const cards = buckets.get(stage)!;
        const extra = stage === 'approval' ? adhoc : [];
        const empty = !count(stage);
        return (
          <section key={stage} className={`min-w-0 rounded-xl p-3 ${empty ? 'self-start bg-muted/40' : 'border bg-muted/25'}`}>
            <div className={`flex items-start justify-between gap-2 ${empty ? '' : 'mb-3'}`}>
              <div>
                <h2 className={`text-sm font-semibold ${empty ? 'text-muted-foreground' : ''}`}>{STAGE_LABEL[stage]}</h2>
                <p className="text-xs text-muted-foreground">{empty ? 'Nothing here' : DESCRIPTION[stage]}</p>
              </div>
              {!empty && <Badge variant="outline" className="bg-background tabular-nums">{count(stage)}</Badge>}
            </div>

            <div className="space-y-2">
              {cards.map((r) => (
                <Card key={r.id} size="sm" className="border-border/80 bg-card py-3">
                  <CardHeader className="gap-0 px-3">
                    <CardTitle className="font-mono text-xs">
                      <Link href={`/sales/${encodeURIComponent(r.requirementNo)}`} className="hover:underline">
                        {r.requirementNo}
                      </Link>
                    </CardTitle>
                    <div className="mt-1 truncate text-sm font-medium">{r.partyName}</div>
                    {r.headline && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{r.headline}</div>
                    )}
                  </CardHeader>
                  <CardContent className="mt-2 space-y-2 px-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.openLines} {r.openLines === 1 ? 'line' : 'lines'} · {r.ageDays}d</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {r.stage === 'approval' && r.onApproval > 0.0005
                          ? `${ct(r.onApproval)} out`
                          : `${ct(r.outstanding)} left`}
                      </span>
                    </div>
                    {r.stage === 'sourcing' && r.sourcedPending > 0.0005 && (
                      <p className="text-xs text-warning">{ct(r.sourcedPending)} on order from a supplier</p>
                    )}
                    {r.stage === 'new' && !r.covered && (
                      <p className="text-xs text-muted-foreground">not in stock — source it</p>
                    )}
                    {stage !== 'closed' && (
                      <Button
                        size="sm" className="w-full"
                        variant={stage === 'ready' ? 'default' : 'outline'}
                        nativeButton={false} render={<Link href={actionHref(r)} />}
                      >
                        {ACTION[stage]}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Goods out on a memo that never came from a requirement: the
                  walk-in half of the business still belongs on this board. */}
              {extra.map((m) => (
                <Card key={m.memoId} size="sm" className="border-dashed bg-card py-3">
                  <CardHeader className="gap-0 px-3">
                    <CardTitle className="font-mono text-xs">{m.memoNo}</CardTitle>
                    <div className="mt-1 truncate text-sm font-medium">{m.partyName}</div>
                    {m.headline && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{m.headline}</div>
                    )}
                  </CardHeader>
                  <CardContent className="mt-2 space-y-2 px-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className={m.overdue ? 'text-negative' : 'text-muted-foreground'}>
                        {m.overdue ? `was due ${day(m.dueOn)}` : m.dueOn ? `back by ${day(m.dueOn)}` : 'no due date'}
                      </span>
                      <span className="font-medium tabular-nums">{ct(m.outstanding)} out</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" nativeButton={false} render={<Link href="/sales?tab=memo" />}>
                      Settle memo
                    </Button>
                  </CardContent>
                </Card>
              ))}

            </div>
          </section>
        );
      })}
    </div>
  );
}
