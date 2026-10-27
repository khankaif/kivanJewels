import Link from 'next/link';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyTitle, EmptyHeader } from '@/components/ui/empty';
import { PageHeader } from '@/components/layout/page-header';
import { getCatalogItems } from '@/features/catalog/queries';
import { setPublishedAction } from '@/features/catalog/actions';
import { inr } from '@/lib/format';
import { imageBase } from '@/lib/r2';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const items = await getCatalogItems();
  const base = imageBase();
  const live = items.filter((i) => i.published).length;

  return (
    <div className="space-y-4">
      <PageHeader
        detail={`${items.length} pieces, ${live} live`}
        title="Catalog"
        actions={
          <Button nativeButton={false} render={<Link href="/catalog/new" />}>
            <Plus data-icon="inline-start" /> Add piece
          </Button>
        }
      />

      {items.length === 0 ? (
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
      )}
    </div>
  );
}
