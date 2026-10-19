import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { getCatalogItem, UUID } from '@/features/catalog/queries';
import { ItemForm } from '@/features/catalog/components/item-form';
import { DeletePiece } from '@/features/catalog/components/delete-piece';
import { getDiamondPicklists } from '@/features/masters/diamonds/queries';
import { imageBase } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/** `/catalog/new` creates; `/catalog/<id>` edits. */
export default async function CatalogItemPage({ params }: PageProps<'/catalog/[id]'>) {
  const { id } = await params;
  const isNew = id === 'new';
  if (!isNew && !UUID.test(id)) notFound();

  const [item, picklists] = await Promise.all([
    isNew ? null : getCatalogItem(id), getDiamondPicklists(),
  ]);
  if (!isNew && !item) notFound();

  const store = process.env.STORE_HOST;
  const liveUrl = item?.published && store
    ? `${store.includes('localhost') ? 'http' : 'https'}://${store}/${item.slug}`
    : null;

  return (
    <div className="space-y-6">
      <Link href="/catalog" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Catalog
      </Link>
      <PageHeader
        eyebrow="Storefront"
        title={item?.title ?? 'New piece'}
        description={item
          ? item.published ? 'Live on the storefront. Changes show up as soon as you save.' : 'Draft. Only staff can see it.'
          : 'Fill in what the piece card shows. It stays a draft until you tick “Show on the storefront”.'}
        actions={
          <>
            {liveUrl && (
              <Button variant="outline" nativeButton={false} render={<a href={liveUrl} target="_blank" rel="noreferrer" />}>
                View in store
              </Button>
            )}
            {item && <DeletePiece id={item.id} title={item.title} />}
          </>
        }
      />
      <Card>
        <CardContent>
          <ItemForm
            item={item}
            categories={picklists.jewellery_category ?? []}
            stoneTypes={picklists.stone_type ?? []}
            imageBase={imageBase()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
