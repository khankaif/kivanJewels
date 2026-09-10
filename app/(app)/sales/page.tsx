import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getRequirements } from '@/features/sales/queries';
import { RequirementForm } from '@/features/sales/components/requirement-form';
import { getPartyOptions } from '@/features/parties/queries';
import { getAgents } from '@/features/memos/queries';
import { getDiamondPicklists } from '@/features/masters/diamonds/queries';
import { ct, inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'closed', 'all'] as const;

const spec = (l: { sieveSize: string | null; mmSize: string | null; shape: string | null; colour: string | null; clarity: string | null }) =>
  [l.sieveSize, l.mmSize && `${l.mmSize}mm`, l.shape, l.colour, l.clarity].filter(Boolean).join(' · ') || '—';

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = STATUSES.includes(status as never) ? (status as (typeof STATUSES)[number]) : 'open';
  const [requirements, customers, picklists, agents] = await Promise.all([
    getRequirements({ status: active }),
    getPartyOptions('client'), getDiamondPicklists(), getAgents(),
  ]);

  const openCarats = requirements.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">
            What customers have asked for. Fulfil each line from stock, or source the shortfall
            from the market.
          </p>
        </div>
        <RequirementForm
          customers={customers} agents={agents}
          shapes={picklists.shape} colours={picklists.colour} clarities={picklists.clarity}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Open requirements" value={String(requirements.filter((r) => r.status === 'open').length)} />
        <Stat label="Outstanding to fulfil" value={ct(openCarats)} />
      </div>

      <div className="flex gap-1">
        {STATUSES.map((s) => (
          <Link
            key={s} href={s === 'open' ? '/sales' : `/sales?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {requirements.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link href={`/sales/${encodeURIComponent(r.requirementNo)}`} className="font-mono underline underline-offset-4">
                  {r.requirementNo}
                </Link>
                <Badge variant={r.status === 'open' ? 'default' : 'secondary'}>{r.status}</Badge>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                <Link href={`/parties/${r.partyId}`} className="underline underline-offset-4">{r.partyName}</Link>
                {' · '}{r.raisedOn}{r.agent && ` · ${r.agent}`}
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Spec</TableHead>
                  <TableHead className="text-right">Wanted</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.lines.map((l) => (
                  <TableRow key={l.lineId} className={l.lineStatus === 'closed' ? 'opacity-50' : undefined}>
                    <TableCell>{spec(l)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ct(l.wanted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ct(l.delivered)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {l.outstanding > 0.0005 ? ct(l.outstanding) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.inStock > 0.0005
                        ? <span className="text-positive">{ct(l.inStock)}</span>
                        : l.sourcedPending > 0.0005
                          ? <span className="text-warning">{ct(l.sourcedPending)} sourced</span>
                          : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.quotedRate ? inr(l.quotedRate) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {!requirements.length && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {active === 'all' ? '' : active} requirements. Raise one when a customer asks.
          </CardContent>
        </Card>
      )}
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
