import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionTabs } from '@/components/layout/section-tabs';
import { FilterBar } from '@/components/layout/filter-bar';
import { resolveTab } from '@/lib/tabs';
import { getOwnedUnits, getMemoStock } from '@/features/stock/queries';
import { getMovements } from '@/features/stock/register';
import { OwnedTable } from '@/features/stock/components/owned-table';
import { MemoTable } from '@/features/stock/components/memo-table';
import { MovementsTable } from '@/features/stock/components/movements-table';
import { AddStockSheet } from '@/features/stock/components/add-stock-sheet';
import { MemoList } from '@/features/memos/components/memo-list';
import { getMemos, getAgents } from '@/features/memos/queries';
import { getPartyOptions } from '@/features/parties/queries';
import { getDiamondPicklists, getSieveShapes } from '@/features/masters/diamonds/queries';
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

  const [suppliers, picklists, agents, sieveShapes] = await Promise.all([
    getPartyOptions('supplier'), getDiamondPicklists(), getAgents(), getSieveShapes(),
  ]);

  // A tab link keeps the current search but always resets paging.
  const href = (t: string) =>
    `/stock?${new URLSearchParams(
      Object.entries({ ...sp, tab: t, page: undefined }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock"
        actions={<AddStockSheet
          suppliers={suppliers} agents={agents} picklists={picklists} sieveShapes={sieveShapes}
          defaultOpen={sp.new === '1'}
        />}
        tabs={<SectionTabs items={TABS.map((t) => ({ href: href(t), label: LABELS[t], active: t === tab }))} />}
      />

      {tab !== 'movements' && (
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
      )}

      {tab === 'owned' && (
        <OwnedTable units={await getOwnedUnits({
          search: sp.q, stoneType: sp.type, certified: sp.cert,
        })} />
      )}

      {/* The same goods two ways: what is here by parcel, and what to settle by
          memo. One at a time, so neither reads as a repeat of the other. */}
      {tab === 'memo' && (
        <Tabs defaultValue="parcels">
          <TabsList>
            <TabsTrigger value="parcels">By parcel</TabsTrigger>
            <TabsTrigger value="memos">By memo</TabsTrigger>
          </TabsList>
          <TabsContent value="parcels">
            <MemoTable rows={await getMemoStock({
              search: sp.q, stoneType: sp.type, certified: sp.cert,
            })} />
          </TabsContent>
          <TabsContent value="memos">
            <MemoList
              memos={await getMemos('in', {
                q: sp.q, status: sp.status as 'all' | 'open' | 'overdue' | undefined,
              })}
              direction="in"
            />
          </TabsContent>
        </Tabs>
      )}

      {tab === 'movements' && <MovementsTable {...await loadMovements(sp)} />}
    </div>
  );
}
