import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getMemos, getMemoSummary, getAgents } from '@/features/memos/queries';
import { getIssuableLots } from '@/features/stock/queries';
import { getPartyOptions } from '@/features/parties/queries';
import { getDiamondPicklists } from '@/features/masters/diamonds/queries';
import { MemoList } from '@/features/memos/components/memo-list';
import { IssueMemoDialog } from '@/features/memos/components/issue-memo-dialog';
import { ReceiveMemoDialog } from '@/features/memos/components/receive-memo-dialog';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MemosPage() {
  const [inward, outward, summary, lots, suppliers, clients, agents, shapes] = await Promise.all([
    getMemos('in'), getMemos('out'), getMemoSummary(),
    getIssuableLots(), getPartyOptions('supplier'), getPartyOptions('client'), getAgents(),
    getDiamondPicklists().then((p) => p.shape),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memos</h1>
          <p className="text-sm text-muted-foreground">
            Goods on approval, in both directions. Nothing is bought or sold until it is billed.
          </p>
        </div>
        <div className="flex gap-2">
          <ReceiveMemoDialog suppliers={suppliers} agents={agents} shapes={shapes} />
          <IssueMemoDialog lots={lots} parties={clients} agents={agents} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Held on supplier memo
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{ct(summary.in.carats)}</div>
            <div className="text-xs text-muted-foreground">
              {inr(summary.in.value)} · {summary.in.open} open
              {summary.in.overdue > 0 && (
                <span className="text-negative"> · {summary.in.overdue} overdue to return or bill</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Out with clients
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{ct(summary.out.carats)}</div>
            <div className="text-xs text-muted-foreground">
              {inr(summary.out.value)} at risk · {summary.out.open} open
              {summary.out.overdue > 0 && (
                <span className="text-negative"> · {summary.out.overdue} overdue</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="out">
        <TabsList>
          <TabsTrigger value="out">Outward — to clients ({outward.length})</TabsTrigger>
          <TabsTrigger value="in">Inward — from suppliers ({inward.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="out">
          <MemoList memos={outward} direction="out" />
        </TabsContent>
        <TabsContent value="in">
          <MemoList memos={inward} direction="in" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
