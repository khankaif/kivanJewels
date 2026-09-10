import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionTabs } from '@/components/layout/section-tabs';
import { resolveTab } from '@/lib/tabs';
import { getOwnedUnits, getMemoStock, getStockTotals } from '@/features/stock/queries';
import { getMovements } from '@/features/stock/register';
import { OwnedTable } from '@/features/stock/components/owned-table';
import { MemoTable } from '@/features/stock/components/memo-table';
import { MovementsTable } from '@/features/stock/components/movements-table';
import { AddStockSheet } from '@/features/stock/components/add-stock-sheet';
import { MemoList } from '@/features/memos/components/memo-list';
import { getMemos, getAgents } from '@/features/memos/queries';
import { getPartyOptions } from '@/features/parties/queries';
import { getDiamondPicklists } from '@/features/masters/diamonds/queries';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TABS = ['owned', 'memo', 'movements'] as const;
const LABELS = { owned: 'My stock', memo: 'On memo', movements: 'Movements' } as const;
const MOVEMENTS_PAGE = 200;

type Params = Record<string, string | undefined>;

/** The movement register's own filters, lifted from the page it used to be. */
async function loadMovements(sp: Params) {
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total, inCarats, outCarats } = await getMovements({
    kind: sp.kind, q: sp.q, from: sp.from, to: sp.to,
    direction: sp.direction === 'in' ? 'in' : sp.direction === 'out' ? 'out' : undefined,
    limit: MOVEMENTS_PAGE, offset: (page - 1) * MOVEMENTS_PAGE,
  });
  return {
    rows, total, inCarats, outCarats, sp,
    page, pages: Math.max(1, Math.ceil(total / MOVEMENTS_PAGE)),
  };
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const tab = resolveTab(sp.tab, TABS);

  const [totals, suppliers, picklists, agents] = await Promise.all([
    getStockTotals(), getPartyOptions('supplier'), getDiamondPicklists(), getAgents(),
  ]);

  // A tab link keeps the current search but always resets paging.
  const href = (t: string) =>
    `/stock?${new URLSearchParams(
      Object.entries({ ...sp, tab: t, page: undefined }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            What you own is one row per shape, sieve, MM, colour and clarity. What you hold on a
            supplier memo is still theirs, so it stays listed by supplier — settle it on that tab.
          </p>
        </div>
        <AddStockSheet
          suppliers={suppliers} agents={agents} shapes={picklists.shape}
          colours={picklists.colour} clarities={picklists.clarity}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="My stock" value={ct(totals.carats)} sub={`${totals.units} units`} />
        <Stat label="Value at cost" value={inr(totals.value)} />
        <Stat label="Held on memo" value={ct(totals.memoCarats)} sub="not yours yet" />
        <Stat label="Out with clients" value={ct(totals.exposure)} sub="on approval" />
      </div>

      <SectionTabs items={TABS.map((t) => ({ href: href(t), label: LABELS[t], active: t === tab }))} />

      {tab !== 'movements' && (
        <form>
          {/* Without this the search would throw you back to the first tab. */}
          <input type="hidden" name="tab" value={tab} />
          <Input
            name="q" defaultValue={sp.q ?? ''} className="max-w-sm"
            placeholder="Search sieve, MM, shape, supplier…"
          />
        </form>
      )}

      {tab === 'owned' && <OwnedTable units={await getOwnedUnits({ search: sp.q })} />}

      {tab === 'memo' && (
        <div className="space-y-6">
          <MemoTable rows={await getMemoStock({ search: sp.q })} />
          <MemoList memos={await getMemos('in')} direction="in" />
        </div>
      )}

      {tab === 'movements' && <MovementsTable {...await loadMovements(sp)} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
