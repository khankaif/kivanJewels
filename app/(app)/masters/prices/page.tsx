import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/page-header';
import { SectionTabs } from '@/components/layout/section-tabs';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { getGrades } from '@/features/masters/grades/queries';
import { getPriceGrid, getPricedTypes, getQualities } from '@/features/masters/prices/queries';
import { qualityLabel } from '@/features/masters/prices/grid';
import { ImportPrices, QualitySheet } from '@/features/masters/prices/components/price-forms';
import { PriceCell } from '@/features/masters/prices/components/price-cell';
import { caratsLabel, mmLabel } from '@/features/masters/sizes/chart';
import { currentUser, isAdmin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

const rupees = (n: number) => n.toLocaleString('en-IN');

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [{ type }, grades, qualities, priced, user] = await Promise.all([
    searchParams, getGrades(), getQualities(), getPricedTypes(), currentUser(),
  ]);
  const admin = await isAdmin(user);
  const types = grades.stoneType.map((t) => t.name);
  const stoneType = type && types.includes(type) ? type : types.find((t) => priced.has(t)) ?? types[0];
  const grid = stoneType ? await getPriceGrid(stoneType) : { qualities: [], rows: [] };
  // Read-only: only priced sizes (300 blank rows say nothing). An admin edits, so sees every size.
  const rows = admin ? grid.rows : grid.rows.filter((r) => r.cells.some((c) => c !== null));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Masters"
        actions={admin && stoneType && <ImportPrices stoneType={stoneType} />}
        tabs={<MastersNav />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Catalog prices · {stoneType}</CardTitle>
          <CardDescription>
            Rupees per carat, by size and quality: what the catalog charges shoppers (Client 3 SP).
            The ERP does not use these. Edit a cell here (it saves when you leave it; blank removes the price),
            or for many at once: Import CSV → Export the grid, fill it in Excel, import it back.
          </CardDescription>
          <SectionTabs items={types.map((t) => ({
            href: `/masters/prices?type=${encodeURIComponent(t)}`,
            label: priced.has(t) ? `${t} · ${priced.get(t)}` : t,
            active: t === stoneType,
          }))} />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">mm</TableHead>
                <TableHead className="text-right">Carats</TableHead>
                {grid.qualities.map((q) => <TableHead key={qualityLabel(q)} className="text-right">{qualityLabel(q)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ size, cells }) => (
                <TableRow key={size.id}>
                  <TableCell>
                    <div className="font-medium">{size.id}</div>
                    <div className="text-xs text-muted-foreground">{size.shape}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{mmLabel(size)}</TableCell>
                  <TableCell className="text-right tabular-nums">{caratsLabel(size)}</TableCell>
                  {cells.map((c, i) => {
                    const q = grid.qualities[i];
                    return (
                      <TableCell key={qualityLabel(q)} className="text-right tabular-nums">
                        {admin
                          ? <PriceCell stoneType={stoneType!} sizeId={size.id} colour={q.colour} clarity={q.clarity}
                                       value={c} label={qualityLabel(q)} />
                          : c === null ? '—' : rupees(c)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={3 + grid.qualities.length} className="py-10 text-center text-muted-foreground">
                    No {stoneType} prices yet. Import CSV → Export the {stoneType} grid, fill in the prices, and import it.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality options</CardTitle>
          <CardDescription>The colour + clarity pairs shoppers choose between. Each is a column of the grid.</CardDescription>
          {admin && (
            <CardAction>
              <QualitySheet colours={grades.colour.map((c) => c.name)} clarities={grades.clarity.map((c) => c.name)}
                            nextOrder={Math.max(0, ...qualities.map((q) => q.sort_order)) + 1} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quality</TableHead>
                <TableHead className="text-right">Prices</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {qualities.map((q) => (
                <TableRow key={qualityLabel(q)} className={q.active ? undefined : 'text-muted-foreground'}>
                  <TableCell className="font-medium">
                    {qualityLabel(q)} {!q.active && <Badge variant="outline">Retired</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{q.prices || '—'}</TableCell>
                  <TableCell className="text-right">
                    {admin && <QualitySheet row={q} colours={[]} clarities={[]} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
