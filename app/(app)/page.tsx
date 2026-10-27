import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Package, PackagePlus, ShoppingBag, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';
import { getDashboard, getForecast, getInbox, type TodoKind } from '@/features/dashboard/queries';
import { CashChart } from '@/features/dashboard/components/cash-chart';
import { Inbox } from '@/features/dashboard/components/inbox';
import { ct, inr, money, pct } from '@/lib/format';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TODO_KINDS: TodoKind[] = ['collect', 'pay', 'memo_out'];

/**
 * The morning page answers two questions: what must I do, and will cash be
 * fine this fortnight. History lives in Accounts; this page looks forward.
 */
export default async function TodayPage({ searchParams }: PageProps<'/'>) {
  const sp = await searchParams;
  const filter = TODO_KINDS.includes(sp.todo as TodoKind) ? (sp.todo as TodoKind) : null;
  const [d, forecast, inbox] = await Promise.all([getDashboard(), getForecast(), getInbox(filter)]);

  const dueIn = forecast.days.reduce((s, p) => s + p.in, 0);
  const dueOut = forecast.days.reduce((s, p) => s + p.out, 0);
  const net = dueIn - dueOut;
  // What the business holds, net of what it owes; the rows under it are the sum.
  const capital = d.receivable + d.value - d.payable;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Today"
        detail={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/stock?new=1" />}>
              <PackagePlus data-icon="inline-start" /> Add stock
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/sales?new=1" />}>
              <ShoppingBag data-icon="inline-start" /> New sale
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Next 14 days</CardTitle>
              <CardDescription>Bills falling due, by date: clients paying in above the line, suppliers to pay below.</CardDescription>
              <div className="col-span-full mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
                <div>
                  <div className={cn('text-2xl font-semibold leading-tight tabular-nums', net < 0 && 'text-negative')} title={inr(net)}>
                    {net < 0 ? '−' : '+'}{money(Math.abs(net))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="text-positive">{money(dueIn)} due in</span>, <span className="text-negative">{money(dueOut)} due out</span>
                  </div>
                </div>
                {(forecast.lateIn > 0.005 || forecast.lateOut > 0.005) && (
                  <div className="text-sm text-muted-foreground">
                    Already late: <span className="font-medium text-foreground">{money(forecast.lateIn)}</span> to collect,{' '}
                    <span className="font-medium text-foreground">{money(forecast.lateOut)}</span> to pay
                  </div>
                )}
              </div>
            </CardHeader>
            {/* An empty chart is a panel of nothing; say it in a line instead. */}
            {dueIn + dueOut > 0.005 ? (
              <CardContent>
                <CashChart data={forecast.days} range="d" />
              </CardContent>
            ) : (
              <CardContent className="text-sm text-muted-foreground">No bills fall due in the next 14 days.</CardContent>
            )}
          </Card>

          <Inbox items={inbox.items} counts={inbox.counts} filter={filter} />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Working capital</CardTitle>
              <CardDescription>What you hold, net of what you owe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-semibold leading-tight tabular-nums" title={inr(capital)}>{money(capital)}</div>
              <ul className="space-y-0.5">
                <Row href="/accounts/bills?direction=sale&status=unpaid" icon={ArrowDownLeft} tone="bg-positive-surface text-positive"
                     label="To collect" sub="Owed by clients" value={money(d.receivable)} exact={inr(d.receivable)} />
                <Row href="/stock" icon={Package} tone="bg-secondary text-secondary-foreground"
                     label="Stock at cost" sub={ct(d.carats)} value={money(d.value)} exact={inr(d.value)} />
                <Row href="/accounts/bills?direction=purchase&status=unpaid" icon={ArrowUpRight} tone="bg-negative-surface text-negative"
                     label="To pay" sub="Owed to suppliers" value={`−${money(d.payable)}`} exact={inr(-d.payable)} />
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>The whole book to date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="text-base font-semibold tabular-nums" title={inr(d.revenue)}>{money(d.revenue)}</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Gross profit</span>
                <span className="text-right">
                  <span className={cn('block text-base font-semibold tabular-nums', d.profit < 0 && 'text-negative')} title={inr(d.profit)}>
                    {money(d.profit)}
                  </span>
                  <span className="block text-xs text-positive">{pct(d.markup)} on cost</span>
                </span>
              </div>
              {d.uncosted > 0 && (
                <p className="text-xs text-muted-foreground">Excludes {money(d.uncosted)} of sales with no recorded cost.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ href, icon: Icon, tone, label, sub, value, exact }: {
  href: string; icon: LucideIcon; tone: string; label: string; sub: string; value: string; exact: string;
}) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', tone)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{sub}</span>
        </span>
        <span className="font-semibold tabular-nums" title={exact}>{value}</span>
      </Link>
    </li>
  );
}
