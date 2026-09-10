import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { SectionTabs } from '@/components/layout/section-tabs';
import { resolveTab } from '@/lib/tabs';
import { getRequirements } from '@/features/sales/queries';
import { RequirementList } from '@/features/sales/components/requirement-list';
import { RequirementForm } from '@/features/sales/components/requirement-form';
import { MemoList } from '@/features/memos/components/memo-list';
import { getMemos, getAgents } from '@/features/memos/queries';
import { getPartyOptions } from '@/features/parties/queries';
import { getDiamondPicklists } from '@/features/masters/diamonds/queries';
import { ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TABS = ['requirements', 'memo'] as const;
const LABELS = { requirements: 'Requirements', memo: 'Out on memo' } as const;
const STATUSES = ['open', 'closed', 'all'] as const;

type Params = Record<string, string | undefined>;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const tab = resolveTab(sp.tab, TABS);
  const status = STATUSES.includes(sp.status as never)
    ? (sp.status as (typeof STATUSES)[number])
    : 'open';

  const [customers, picklists, agents] = await Promise.all([
    getPartyOptions('client'), getDiamondPicklists(), getAgents(),
  ]);
  const requirements = tab === 'requirements' ? await getRequirements({ status }) : [];
  const openCarats = requirements.reduce((s, r) => s + r.outstanding, 0);

  const href = (over: Params) =>
    `/sales?${new URLSearchParams(
      Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">
            What customers have asked for. Fulfil each line from stock, or source the shortfall
            from the market. Goods sent on approval sit on the memo tab until they come back or
            get billed.
          </p>
        </div>
        <RequirementForm
          customers={customers} agents={agents}
          shapes={picklists.shape} colours={picklists.colour} clarities={picklists.clarity}
        />
      </div>

      <SectionTabs
        items={TABS.map((t) => ({
          href: href({ tab: t, status: undefined }), label: LABELS[t], active: t === tab,
        }))}
      />

      {tab === 'requirements' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat
              label="Open requirements"
              value={String(requirements.filter((r) => r.status === 'open').length)}
            />
            <Stat label="Outstanding to fulfil" value={ct(openCarats)} />
          </div>

          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <Link
                key={s} href={href({ status: s === 'open' ? undefined : s })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  status === s
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </Link>
            ))}
          </div>

          <RequirementList
            requirements={requirements}
            emptyLabel={status === 'all' ? '' : status}
          />
        </div>
      )}

      {tab === 'memo' && <MemoList memos={await getMemos('out')} direction="out" />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
