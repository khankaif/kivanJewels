import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getMemos, getMemoSummary, getAgents } from '@/features/memos/queries';
import { getIssuableLots } from '@/features/stock/queries';
import { getPartyOptions } from '@/features/parties/queries';
import { MemoList } from '@/features/memos/components/memo-list';
import { IssueMemoDialog } from '@/features/memos/components/issue-memo-dialog';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MemosPage() {
  const [inward, outward, summary, lots, clients, agents] = await Promise.all([
    getMemos('in'), getMemos('out'), getMemoSummary(),
    getIssuableLots(), getPartyOptions('client'), getAgents(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memos</h1>
          <p className="text-sm text-muted-foreground">
            Goods on approval, in both directions. Nothing is bought or sold until it is billed.
            Receive goods on memo from <Link href="/stock" className="underline underline-offset-4">Stock</Link>.
          </p>
        </div>
        <IssueMemoDialog lots={lots} parties={clients} agents={agents} />
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
