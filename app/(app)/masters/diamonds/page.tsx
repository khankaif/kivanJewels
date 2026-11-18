import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/page-header';
import { SectionTabs } from '@/components/layout/section-tabs';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { getShapes, getSizesPage } from '@/features/masters/sizes/queries';
import { caratsLabel, mmLabel } from '@/features/masters/sizes/chart';
import { ImportSizes, ShapeSheet, SizeSheet } from '@/features/masters/sizes/components/size-forms';
import { currentUser, isAdmin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

const PER_PAGE = 30;

export default async function SizesPage({
  searchParams,
}: {
  searchParams: Promise<{ shape?: string; page?: string }>;
}) {
  const [{ shape: rawShape, page: pageStr }, shapes, user] = await Promise.all([
    searchParams, getShapes(), currentUser(),
  ]);
  const admin = await isAdmin(user);
  const validShapes = new Set(shapes.map((s) => s.shape));
  const filter = rawShape && validShapes.has(rawShape) ? rawShape : undefined;
  const used = shapes.filter((s) => s.sizes > 0);

  const rawPage = Math.max(1, Number(pageStr) || 1);
  const offset = (rawPage - 1) * PER_PAGE;

  const { rows, total } = await getSizesPage({
    shape: filter,
    limit: PER_PAGE,
    offset,
  });

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(rawPage, pages);
  const start = (page - 1) * PER_PAGE;

  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    if (filter) sp.set('shape', filter);
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return `/masters/diamonds${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Masters"
        actions={admin && <><ImportSizes /><SizeSheet shapes={shapes} /></>}
        tabs={<MastersNav />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Size chart</CardTitle>
          <CardDescription>
            {total
              ? `${total} sizes across ${used.length} shapes: face-up mm and the carats one stone weighs.`
              : 'No sizes yet. Import the client chart (Import CSV → Client chart sample).'}
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
                <TableHead className="text-right">mm</TableHead>
                <TableHead className="text-right">L / W</TableHead>
                <TableHead className="text-right">Carats</TableHead>
                <TableHead className="text-right">In use</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className={s.active ? undefined : 'text-muted-foreground'}>
                  <TableCell>
                    <div className="font-medium">{s.id} {!s.active && <Badge variant="outline">Retired</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{s.shape}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{mmLabel(s)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.ratio.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{caratsLabel(s)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.used || '—'}</TableCell>
                  <TableCell className="text-right">{admin && <SizeSheet size={s} shapes={shapes} />}</TableCell>
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
        {pages > 1 && (
          <CardFooter className="flex items-center justify-between border-t py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {start + 1}–{Math.min(start + PER_PAGE, total)} of {total} sizes
            </span>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                {page > 1 && (
                  <PaginationItem>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={makeHref(page - 1)} />}>
                      <ChevronLeft data-icon="inline-start" /> Previous
                    </Button>
                  </PaginationItem>
                )}
                <span className="px-2 text-xs text-muted-foreground">
                  Page {page} of {pages}
                </span>
                {page < pages && (
                  <PaginationItem>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={makeHref(page + 1)} />}>
                      Next <ChevronRight data-icon="inline-end" />
                    </Button>
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shapes</CardTitle>
          <CardDescription>Each shape’s code prefixes its Size IDs. Round alone is graded on cut.</CardDescription>
          {admin && (
            <CardAction><ShapeSheet nextOrder={Math.max(0, ...shapes.map((s) => s.sort_order)) + 1} /></CardAction>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shape</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Graded on</TableHead>
                <TableHead className="text-right">Sizes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shapes.map((s) => (
                <TableRow key={s.shape} className={s.active ? undefined : 'text-muted-foreground'}>
                  <TableCell className="font-medium">
                    {s.shape} {!s.active && <Badge variant="outline">Retired</Badge>}
                  </TableCell>
                  <TableCell className="font-mono">{s.code}</TableCell>
                  <TableCell>{s.has_cut ? 'Cut, polish, symmetry' : 'Polish, symmetry'}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.sizes || '—'}</TableCell>
                  <TableCell className="text-right">{admin && <ShapeSheet shape={s} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
