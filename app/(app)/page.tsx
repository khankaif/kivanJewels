import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDashboard, getWorklist } from '@/features/dashboard/queries';
import { inr, ct, pct } from '@/lib/format';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">
          What needs acting on first, then the numbers. Every figure is an aggregate over the
          movement and money ledgers — nothing is stored.
        </p>
      </div>

      <section className="space-y-3">
        {work.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nothing outstanding. No open memos, no bills past terms.
            </CardContent>
          </Card>
        ) : (
          work.map((w) => {
            const u = URGENCY[w.urgency];
            return (
              <Link key={w.key} href={w.href} className="block">
                <Card className={`transition-colors hover:bg-accent/40 ${u.ring}`}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                      <Badge variant={u.badge}>{w.count}</Badge>
                      <div>
                        <div className="font-medium">{w.label}</div>
                        <div className="text-xs text-muted-foreground">{w.detail}</div>
                      </div>
                    </div>
                    <div className="text-right font-bold tabular-nums">{inr(w.value)}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${c.tone ?? ''}`}>{c.value}</div>
              {c.sub && <div className="mt-0.5 text-xs text-muted-foreground">{c.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
