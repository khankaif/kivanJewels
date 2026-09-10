import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRequirement, getDeliverableStock } from '@/features/sales/queries';
import { FulfilSheet } from '@/features/sales/components/fulfil-sheet';
import { closeRequirementLineAction, setRequirementStatusAction } from '@/features/sales/actions';
import { getPartyOptions } from '@/features/parties/queries';
import { getAgents } from '@/features/memos/queries';
import { ct, inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

const spec = (l: { sieveSize: string | null; mmSize: string | null; shape: string | null; colour: string | null; clarity: string | null }) =>
  [l.sieveSize, l.mmSize && `${l.mmSize}mm`, l.shape, l.colour, l.clarity].filter(Boolean).join(' · ') || '—';

export default async function RequirementPage({
  params,
}: {
  params: Promise<{ requirementNo: string }>;
}) {
  const { requirementNo } = await params;
  const req = await getRequirement(decodeURIComponent(requirementNo));
  if (!req) notFound();

  const [stockByLine, suppliers, agents] = await Promise.all([
    Promise.all(req.lines.map((l) => getDeliverableStock(l.unitKey))),
    getPartyOptions('supplier'),
    getAgents(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sales" className="text-sm text-muted-foreground underline underline-offset-4">← All requirements</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            <span className="font-mono">{req.requirementNo}</span>
            <Badge variant={req.status === 'open' ? 'default' : 'secondary'}>{req.status}</Badge>
          </h1>
          <form action={setRequirementStatusAction}>
            <input type="hidden" name="requirementId" value={req.id} />
            <input type="hidden" name="status" value={req.status === 'open' ? 'closed' : 'open'} />
            <Button type="submit" size="sm" variant="outline">
              {req.status === 'open' ? 'Close requirement' : 'Reopen'}
            </Button>
          </form>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/parties/${req.partyId}`} className="underline underline-offset-4">{req.partyName}</Link>
          {' · '}{req.raisedOn}{req.agent && ` · ${req.agent}`}
        </p>
        {req.notes && <p className="mt-1 text-sm">{req.notes}</p>}
      </div>

      {req.lines.map((line, i) => {
        const done = line.outstanding <= 0.0005 || line.lineStatus === 'closed';
        return (
          <Card key={line.lineId}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{spec(line)}</CardTitle>
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    {ct(line.delivered)} of {ct(line.wanted)} delivered
                    {line.outstanding > 0.0005 && ` · ${ct(line.outstanding)} to go`}
                  </span>
                  {line.quotedRate && <span className="tabular-nums">@ {inr(line.quotedRate)}</span>}
                  {line.lineStatus === 'closed' && <Badge variant="secondary">closed</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 text-sm">
              <span className={line.inStock > 0.0005 ? 'text-positive' : 'text-muted-foreground'}>
                {line.inStock > 0.0005 ? `${ct(line.inStock)} of this spec in stock` : 'not in stock'}
              </span>
              {line.sourcedPending > 0.0005 && (
                <span className="text-warning">{ct(line.sourcedPending)} sourced, pending delivery</span>
              )}
              <div className="ml-auto flex gap-2">
                {!done && (
                  <FulfilSheet
                    line={line} stock={stockByLine[i]} suppliers={suppliers} agents={agents}
                  />
                )}
                {line.lineStatus === 'open' && line.outstanding > 0.0005 && (
                  <form action={closeRequirementLineAction}>
                    <input type="hidden" name="lineId" value={line.lineId} />
                    <input type="hidden" name="requirementId" value={req.id} />
                    <Button type="submit" size="sm" variant="ghost">Close short</Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
