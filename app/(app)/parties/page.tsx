import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getParties } from '@/features/parties/queries';
import { PartyDialog } from '@/features/parties/components/party-dialog';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string; new?: string }>;
}) {
  const { q, all, new: openNew } = await searchParams;
  const parties = await getParties({ search: q, includeInactive: all === '1' });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Masters</h1>
          <p className="text-sm text-muted-foreground">
            Suppliers and clients. Credit terms set the due date on inward memos.
          </p>
        </div>
        <PartyDialog defaultOpen={openNew === '1'} />
      </div>

      <MastersNav />

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>{parties.length} parties</CardTitle>
            <CardDescription>Sorted by size of outstanding balance.</CardDescription>
          </div>
          <form className="flex gap-2">
            <Input name="q" defaultValue={q ?? ''} placeholder="Search name, business name, phone, GSTIN…" className="max-w-xs" />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="all" value="1" defaultChecked={all === '1'} className="size-4" />
              show inactive
            </label>
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Terms</TableHead>
                <TableHead className="text-right">Open memos</TableHead>
                <TableHead className="text-right">Receivable</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((p) => (
                <TableRow key={p.id} className={p.isActive ? undefined : 'opacity-50'}>
                  <TableCell className="font-medium">
                    <Link href={`/parties/${p.id}`} className="underline underline-offset-4">
                      {p.name}
                    </Link>
                    {(p.businessName || p.phone) && (
                      <div className="text-xs text-muted-foreground">
                        {[p.businessName, p.phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {p.kind === 'both' ? 'supplier & client' : p.kind}
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
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      p.net > 0 ? 'text-positive' : p.net < 0 ? 'text-warning' : ''
                    }`}
                  >
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
