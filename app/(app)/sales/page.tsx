import { SectionTabs } from '@/components/layout/section-tabs';
import { FilterBar } from '@/components/layout/filter-bar';
import { resolveTab } from '@/lib/tabs';
import { getAdhocApprovals, getPipeline, getSellableUnits } from '@/features/sales/queries';
import { SalesPipeline } from '@/features/sales/components/sales-pipeline';
import { NewSaleSheet } from '@/features/sales/components/new-sale-sheet';
import { MemoList } from '@/features/memos/components/memo-list';
import { getMemos, getAgents } from '@/features/memos/queries';
import { getPartyOptions } from '@/features/parties/queries';
import { getDiamondPicklists, getSieveShapes } from '@/features/masters/diamonds/queries';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

const TABS = ['requirements', 'memo'] as const;
const LABELS = { requirements: 'Requirements', memo: 'Out on memo' } as const;

type Params = Record<string, string | undefined>;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const tab = resolveTab(sp.tab, TABS);

  const [customers, suppliers, picklists, agents, sieveShapes, units] = await Promise.all([
    getPartyOptions('client'), getPartyOptions('supplier'), getDiamondPicklists(), getAgents(),
    getSieveShapes(), getSellableUnits(),
  ]);
  // Stage is the board's own axis, so the filters here are the other three
  // questions: whose sale, whose deal, and which stone.
  const filters = { partyId: sp.party, agent: sp.agent, q: sp.q };
  const [rows, adhoc] = tab === 'requirements'
    ? await Promise.all([getPipeline(filters), getAdhocApprovals(filters)])
    : [[], []];

  const href = (over: Params) =>
    `/sales?${new URLSearchParams(
      Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales"
        actions={<NewSaleSheet
          customers={customers} suppliers={suppliers} agents={agents}
          picklists={picklists} sieveShapes={sieveShapes} units={units}
          defaultOpen={sp.new === '1'} defaultLot={sp.lot}
        />}
        tabs={<SectionTabs
        items={TABS.map((t) => ({ href: href({ tab: t }), label: LABELS[t], active: t === tab }))}
      />}
      />

      {tab === 'requirements' && (
        <div className="space-y-6">

          <FilterBar
            hidden={{ tab }}
            fields={[
              { type: 'text', name: 'q', label: 'Search', value: sp.q,
                placeholder: 'Requirement no., party or stone' },
              { type: 'select', name: 'party', label: 'Customer', value: sp.party, options: [
                { value: '', label: 'All customers' },
                ...customers.map((p) => ({ value: p.id, label: p.name })),
              ] },
              { type: 'select', name: 'agent', label: 'Placed by', value: sp.agent, options: [
                { value: '', label: 'Anyone' },
                ...agents.map((a) => ({ value: a, label: a })),
              ] },
            ]}
          />

          <SalesPipeline rows={rows} adhoc={adhoc} />
        </div>
      )}

      {tab === 'memo' && (
        <div className="space-y-6">
          <FilterBar
            hidden={{ tab }}
            fields={[
              { type: 'text', name: 'q', label: 'Search', value: sp.q,
                placeholder: 'Memo no., customer or stone' },
              { type: 'select', name: 'party', label: 'Customer', value: sp.party, options: [
                { value: '', label: 'All customers' },
                ...customers.map((p) => ({ value: p.id, label: p.name })),
              ] },
              { type: 'select', name: 'status', label: 'Show', value: sp.status, options: [
                { value: 'all', label: 'All memos' },
                { value: 'open', label: 'Open only' },
                { value: 'overdue', label: 'Overdue only' },
              ] },
            ]}
          />
          <MemoList
            memos={await getMemos('out', {
              partyId: sp.party, q: sp.q,
              status: sp.status as 'all' | 'open' | 'overdue' | undefined,
            })}
            direction="out"
          />
        </div>
      )}
    </div>
  );
}
