import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyTitle, EmptyHeader } from '@/components/ui/empty';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { PageHeader } from '@/components/layout/page-header';
import { getCatalogItemsPage } from '@/features/catalog/queries';
import { setPublishedAction } from '@/features/catalog/actions';
import { inr } from '@/lib/format';
import { imageBase } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const rawPage = Math.max(1, Number(sp.page) || 1);
  const offset = (rawPage - 1) * PER_PAGE;

  const { rows: items, total, live } = await getCatalogItemsPage({
    limit: PER_PAGE,
    offset,
  });

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(rawPage, pages);
  const start = (page - 1) * PER_PAGE;
  const base = imageBase();

  const makeHref = (p: number) => (p > 1 ? `/catalog?page=${p}` : '/catalog');

  return (
    <div className="space-y-4">
      <PageHeader
        detail={`${total} pieces, ${live} live`}
        title="Catalog"
        actions={
          <Button nativeButton={false} render={<Link href="/catalog/new" />}>
            <Plus data-icon="inline-start" /> Add piece
          </Button>
        }
      />

      {total === 0 ? (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyTitle>No pieces yet</EmptyTitle>
            <EmptyDescription>Add a piece with its photos, weights and MRP, then publish it.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/catalog/new" />}>
              <Plus data-icon="inline-start" /> Add your first piece
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((it) => (
              <Card key={it.id} className="pt-0">
                <Link href={`/catalog/${it.id}`} className="relative block aspect-square bg-muted">
                  {base && it.images[0] && (
                    <Image src={`${base}/${it.images[0]}`} alt="" fill unoptimized className="object-cover" />
                  )}
                </Link>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/catalog/${it.id}`} className="font-medium leading-snug hover:underline">
                      {it.title}
                    </Link>
                    <Badge variant={it.published ? 'default' : 'outline'}>{it.published ? 'Live' : 'Draft'}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{it.category}</span>
                    {it.mrp !== null && <span className="tabular-nums">{inr(it.mrp)}</span>}
                  </div>
                  <form action={setPublishedAction}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="published" value={it.published ? '' : '1'} />
                    <Button
                      type="submit" size="sm" variant="outline" className="w-full"
                      disabled={!it.published && !it.images.length}
                      title={!it.published && !it.images.length ? 'Add a photo first' : undefined}
                    >
                      {it.published ? 'Unpublish' : 'Publish'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">
                Showing {start + 1}–{Math.min(start + PER_PAGE, total)} of {total} pieces
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
