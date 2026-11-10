import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/page-header';
import { SectionTabs } from '@/components/layout/section-tabs';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { getShapes, getSizes } from '@/features/masters/sizes/queries';
import { bandLabel } from '@/features/masters/sizes/chart';
import { GenerateSizes, ShapeSheet, SizeSheet } from '@/features/masters/sizes/components/size-forms';

export const dynamic = 'force-dynamic';

const mm = (x: number | null) => (x === null ? '—' : x.toFixed(2));

export default async function DiamondsPage({ searchParams }: { searchParams: Promise<{ shape?: string }> }) {
  const [{ shape: filter }, shapes, sizes] = await Promise.all([searchParams, getShapes(), getSizes()]);
  const rows = filter ? sizes.filter((s) => s.shape === filter) : sizes;
  const used = shapes.filter((s) => s.sizes > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Masters"
        actions={<><GenerateSizes shapes={shapes} /><SizeSheet shapes={shapes} /></>}
        tabs={<MastersNav />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Size chart</CardTitle>
          <CardDescription>
            {sizes.length
              ? `${sizes.length} sizes across ${used.length} shapes. Carat bands never overlap within a shape.`
              : 'Carat-per-stone bands per shape: what every parcel is identified by. Start with Generate standard sizes, then add melee bands.'}
          </CardDescription>
          {used.length > 1 && (
            <SectionTabs items={[
              { href: '/masters/diamonds', label: 'All', active: !filter },
              ...used.map((s) => ({
                href: `/masters/diamonds?shape=${encodeURIComponent(s.shape)}`, label: s.shape, active: filter === s.shape,
              })),
            ]} />
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Fits stones of</TableHead>
                <TableHead className="text-right">Est. size</TableHead>
                <TableHead className="text-right">L / W</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.id}</div>
                    <div className="text-xs text-muted-foreground">{s.shape}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.nominal_ct.toFixed(2)} ct</TableCell>
                  <TableCell className="tabular-nums">{bandLabel(s)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.lengthMm === s.widthMm ? `⌀ ${mm(s.lengthMm)}` : `${mm(s.lengthMm)} × ${mm(s.widthMm)}`} mm
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{(s.lengthMm / s.widthMm).toFixed(2)}</TableCell>
                  <TableCell className="text-right"><SizeSheet size={s} shapes={shapes} /></TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No sizes yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shapes</CardTitle>
          <CardDescription>
            Each shape&apos;s Size ID prefix and the 1 ct size its estimated mm scale from.
          </CardDescription>
          <CardAction><ShapeSheet /></CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shape</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead className="text-right">1 ct length mm</TableHead>
                <TableHead className="text-right">1 ct width mm</TableHead>
                <TableHead className="text-right">L / W</TableHead>
                <TableHead className="text-right">Sizes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shapes.map((s) => (
                <TableRow key={s.shape}>
                  <TableCell className="font-medium">{s.shape}</TableCell>
                  <TableCell className="font-mono">{s.prefix}</TableCell>
                  <TableCell className="text-right tabular-nums">{mm(s.lengthMm)}</TableCell>
                  <TableCell className="text-right tabular-nums">{mm(s.widthMm)}</TableCell>
                  <TableCell className="text-right tabular-nums">{mm(s.ratio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.sizes || '—'}</TableCell>
                  <TableCell className="text-right"><ShapeSheet shape={s} /></TableCell>
                </TableRow>
              ))}
              {!shapes.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No shapes yet.
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
