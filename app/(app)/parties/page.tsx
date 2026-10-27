import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getParties, PARTY_SORTS } from '@/features/parties/queries';
import { SortHead } from '@/components/layout/sort-head';
import { parseSort } from '@/lib/sort';
import { PartyDialog } from '@/features/parties/components/party-dialog';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { inr } from '@/lib/format';
import { PageHeader } from '@/components/layout/page-header';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export const dynamic = 'force-dynamic';

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string; new?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const { q, all, new: openNew } = sp;
  // Default order: largest balance either way, the parties that matter most today.
  const sort = parseSort(sp.sort, PARTY_SORTS, { col: 'net', dir: 'desc' });
  const parties = await getParties({ search: q, includeInactive: all === '1', sort: sp.sort ? sort : undefined });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Masters"
        actions={<PartyDialog defaultOpen={openNew === '1'} />}
        tabs={<MastersNav />}
      />

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>{parties.length} parties</CardTitle>
            <CardDescription>Sorted by size of outstanding balance.</CardDescription>
          </div>
          <form className="flex gap-2">
            <Input name="q" defaultValue={q ?? ''} placeholder="Search name, business name, phone, GSTIN…" className="max-w-xs" />
            <Label className="text-muted-foreground">
              <Checkbox name="all" value="1" defaultChecked={all === '1'} />
              show inactive
            </Label>
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead col="name" label="Name" sort={sort} sp={sp} path="/parties" />
                <TableHead>Role</TableHead>
                <SortHead col="terms" label="Terms" sort={sort} sp={sp} path="/parties" className="text-right" />
                <TableHead className="text-right">Open memos</TableHead>
                <SortHead col="receivable" label="Receivable" sort={sort} sp={sp} path="/parties" first="desc" className="text-right" />
                <SortHead col="payable" label="Payable" sort={sort} sp={sp} path="/parties" first="desc" className="text-right" />
                <SortHead col="net" label="Net" sort={sort} sp={sp} path="/parties" first="desc" className="text-right" />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((p) => (
                <TableRow key={p.id} className={p.isActive ? undefined : 'opacity-50'}>
                  <TableCell className="font-medium">
                    <Link href={`/parties/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {(p.businessName || p.phone) && (
                      <div className="text-xs text-muted-foreground">
                        {[p.businessName, p.phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* Tags as Twenty draws them: a soft tint per value, never an outline. */}
                    <Badge variant="secondary" className={p.kind === 'client' ? 'bg-accent-blue-surface text-accent-blue' : undefined}>
                      {p.kind === 'both' ? 'Supplier & client' : p.kind === 'client' ? 'Client' : 'Supplier'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.defaultTermsDays}d</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {p.openMemosIn > 0 && <span className="mr-2">in {p.openMemosIn}</span>}
                    {p.openMemosOut > 0 && <span>out {p.openMemosOut}</span>}
                    {!p.openMemosIn && !p.openMemosOut && '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.receivable > 0 ? inr(p.receivable) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.payable > 0 ? inr(p.payable) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {p.net !== 0 ? inr(p.net) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <PartyDialog party={p} />
                  </TableCell>
                </TableRow>
              ))}
              {!parties.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No parties match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
