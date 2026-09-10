import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDashboard, getWorklist } from '@/features/dashboard/queries';
import { inr, ct, pct } from '@/lib/format';
import { PageHeader } from '@/components/layout/page-header';
import { ArrowRight, CircleDollarSign, Gem, HandCoins, PackagePlus, ShoppingBag } from 'lucide-react';

const URGENCY: Record<string, { badge: 'destructive' | 'default' | 'secondary'; ring: string }> = {
  critical: { badge: 'destructive', ring: 'border-negative/40' },
  warning: { badge: 'default', ring: 'border-warning/40' },
  info: { badge: 'secondary', ring: '' },
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [d, work] = await Promise.all([getDashboard(), getWorklist()]);

  const cards: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: 'Revenue', value: inr(d.revenue) },
    {
      label: 'Gross profit', value: inr(d.profit),
      // Sales with no recorded cost are excluded rather than booked as pure
      // profit; saying so here is what the deleted panel's caveat was for.
      sub: `${pct(d.markup)} on cost`
        + (d.uncosted > 0 ? ` · excludes ${inr(d.uncosted)} uncosted` : ''),
      tone: d.profit >= 0 ? 'text-positive' : 'text-negative',
    },
    { label: 'Receivable', value: inr(d.receivable), tone: 'text-positive' },
    { label: 'Payable', value: inr(d.payable), tone: 'text-warning' },
    {
      label: 'My stock', value: ct(d.carats),
      sub: `${inr(d.value)} at cost · ${d.units} units` +
           (d.memoCarats ? ` · ${ct(d.memoCarats)} on memo` : ''),
    },
    {
      label: 'Out on memo', value: ct(d.exposure),
      sub: `${d.openMemos} open${d.overdueMemos ? ` · ${d.overdueMemos} overdue` : ''}`,
      tone: d.overdueMemos ? 'text-negative' : undefined,
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Daily desk"
        title="Today’s work"
        description="Start with what needs a decision. Your stock and money positions update from the live ledgers."
        actions={<QuickActions />}
      />

      <section className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Needs your attention</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Ordered by risk, not by when it was entered.</p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {work.length} open
            </span>
          </div>
        {work.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 py-10 text-center text-muted-foreground">
              Nothing outstanding. No open memos, no bills past terms.
            </div>
        ) : (
          <div className="space-y-2">
            {work.map((w) => {
            const u = URGENCY[w.urgency];
            return (
              <Link key={w.key} href={w.href} className="group block">
                <div className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-background px-3.5 py-3 transition-all hover:-translate-y-px hover:border-primary/30 hover:bg-accent/35 ${u.ring}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge variant={u.badge} className="min-w-6 justify-center">{w.count}</Badge>
                      <div>
                        <div className="font-medium">{w.label}</div>
                        <div className="text-xs text-muted-foreground">{w.detail}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div className="font-semibold tabular-nums">{inr(w.value)}</div>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                </div>
              </Link>
            );
            })}
          </div>
        )}
        </div>
        <PositionSummary d={d} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Business position</h2>
            <p className="text-xs text-muted-foreground">A compact read of the book, not another task list.</p>
          </div>
        </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="transition-shadow hover:shadow-sm">
            <CardContent className="pt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{c.label}</div>
              <div className={`mt-1 text-2xl font-semibold tabular-nums ${c.tone ?? ''}`}>{c.value}</div>
              {c.sub && <div className="mt-0.5 text-xs text-muted-foreground">{c.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
      </section>

    </div>
  );
}

function QuickActions() {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href="/stock?new=1" className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted">
        <PackagePlus className="size-3.5" /> Add stock
      </Link>
      <Link href="/sales?new=1" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85">
        <ShoppingBag className="size-3.5" /> New sale
      </Link>
    </div>
  );
}

function PositionSummary({ d }: { d: Awaited<ReturnType<typeof getDashboard>> }) {
  return (
    <div className="rounded-xl bg-foreground p-5 text-background shadow-sm">
      <div className="flex items-center gap-2 text-background/70">
        <CircleDollarSign className="size-4" />
        <span className="text-xs font-medium uppercase tracking-[0.1em]">Cash position</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-background/60"><HandCoins className="size-3.5" /> To collect</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{inr(d.receivable)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-background/60"><Gem className="size-3.5" /> To pay</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{inr(d.payable)}</div>
        </div>
      </div>
      <div className="mt-5 border-t border-background/15 pt-4 text-xs leading-5 text-background/65">
        Open client approvals: <span className="font-semibold text-background">{d.openMemos}</span>
        {d.overdueMemos > 0 && <> · <span className="font-semibold text-background">{d.overdueMemos} overdue</span></>}
      </div>
    </div>
  );
}
