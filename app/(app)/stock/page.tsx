import { Card, CardContent } from '@/components/ui/card';
import { SectionTabs } from '@/components/layout/section-tabs';
import { FilterBar } from '@/components/layout/filter-bar';
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
import { getDiamondPicklists, getSieveShapes } from '@/features/masters/diamonds/queries';
import { inr, ct } from '@/lib/format';
import { PageHeader } from '@/components/layout/page-header';

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

  const [totals, suppliers, picklists, agents, sieveShapes] = await Promise.all([
    getStockTotals(), getPartyOptions('supplier'), getDiamondPicklists(), getAgents(), getSieveShapes(),
  ]);

  // A tab link keeps the current search but always resets paging.
  const href = (t: string) =>
    `/stock?${new URLSearchParams(
      Object.entries({ ...sp, tab: t, page: undefined }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Stock desk"
        description="See what is available, held on supplier approval, or already moving through the business."
        actions={<AddStockSheet
          suppliers={suppliers} agents={agents} picklists={picklists} sieveShapes={sieveShapes}
          defaultOpen={sp.new === '1'}
        />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="My stock" value={ct(totals.carats)} sub={`${totals.units} units`} />
        <Stat label="Value at cost" value={inr(totals.value)} />
        <Stat label="Held on memo" value={ct(totals.memoCarats)} sub="not yours yet" />
        <Stat label="Out with clients" value={ct(totals.exposure)} sub="on approval" />
      </div>

      <SectionTabs items={TABS.map((t) => ({ href: href(t), label: LABELS[t], active: t === tab }))} />

      {tab !== 'movements' && (
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <FilterBar
            /* Without this the filters would throw you back to the first tab. */
            hidden={{ tab }}
            fields={[
              { type: 'text', name: 'q', label: 'Search', value: sp.q,
                placeholder: 'Size, shape, colour, lot or supplier' },
              { type: 'select', name: 'type', label: 'Diamond type', value: sp.type, options: [
                { value: '', label: 'All types' },
                ...(picklists.stone_type ?? []).map((v) => ({ value: v, label: v })),
              ] },
              { type: 'select', name: 'cert', label: 'Certified', value: sp.cert, options: [
                { value: '', label: 'Certified & not' },
                ...(picklists.certified ?? []).map((v) => ({ value: v, label: v })),
                ...(picklists.lab ?? []).map((v) => ({ value: v, label: `${v} certified` })),
              ] },
            ]}
          />
        </div>
      )}

      {tab === 'owned' && (
        <OwnedTable units={await getOwnedUnits({
          search: sp.q, stoneType: sp.type, certified: sp.cert,
        })} />
      )}

      {tab === 'memo' && (
        <div className="space-y-6">
          <MemoTable rows={await getMemoStock({
            search: sp.q, stoneType: sp.type, certified: sp.cert,
          })} />
          <MemoList
            memos={await getMemos('in', {
              q: sp.q, status: sp.status as 'all' | 'open' | 'overdue' | undefined,
            })}
            direction="in"
          />
        </div>
      )}

      {tab === 'movements' && <MovementsTable {...await loadMovements(sp)} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="shadow-xs">
      <CardContent className="pt-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
