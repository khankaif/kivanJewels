import { Card, CardContent } from '@/components/ui/card';
import { getDashboard } from '@/features/dashboard/queries';
import { inr, ct, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const d = await getDashboard();

  const cards: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: 'Revenue', value: inr(d.revenue) },
    {
      label: 'Gross profit', value: inr(d.profit),
      sub: `${pct(d.markup)} on cost`, tone: d.profit >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    { label: 'Receivable', value: inr(d.receivable), tone: 'text-emerald-600' },
    { label: 'Payable', value: inr(d.payable), tone: 'text-amber-600' },
    { label: 'In vault', value: ct(d.carats), sub: `${inr(d.value)} at cost · ${d.lots} lots` },
    {
      label: 'Out on memo', value: ct(d.exposure),
      sub: `${d.openMemos} open${d.overdueMemos ? ` · ${d.overdueMemos} overdue` : ''}`,
      tone: d.overdueMemos ? 'text-red-600' : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Every figure is an aggregate over the movement and money ledgers — nothing is stored.
        </p>
      </div>
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

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            Profit by business
          </div>
          <div className="space-y-2">
            {d.segments.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {inr(s.revenue - s.uncosted)} − {inr(s.cost)} =
                </span>
                <span
                  className={`w-44 text-right font-bold tabular-nums ${
                    s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {inr(s.profit)} ({pct(s.markup)} on cost)
                </span>
              </div>
            ))}
          </div>
          {d.uncosted > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Excludes <strong>{inr(d.uncosted)}</strong> of sales with no recorded cost (opening
              stock sold before the book starts). Your sheet leaves Profit Loss blank on those rows
              rather than booking them as pure profit, and this follows that.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Profit % is on cost, matching the sheet&apos;s Profit % column. Cost of sales counts only
            lots that have sold; unsold inventory stays on the balance sheet. Jewellery cost bundles
            ₹2,63,937 of diamonds that may also appear in the diamond segment — the workbook records
            those stones on two sheets with no key linking them.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
