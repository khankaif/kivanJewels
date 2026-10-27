import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { getCatalogItem, UUID } from '@/features/catalog/queries';
import { ItemForm } from '@/features/catalog/components/item-form';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { deleteItemAction } from '@/features/catalog/actions';
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
    <div className="space-y-4">
      <PageHeader
        parent={{ href: '/catalog', label: 'Catalog' }}
        title={item?.title ?? 'New piece'}
        badges={item && <Badge variant={item.published ? 'default' : 'outline'}>{item.published ? 'Live' : 'Draft'}</Badge>}
        actions={
          <>
            {liveUrl && (
              <Button variant="outline" nativeButton={false} render={<a href={liveUrl} target="_blank" rel="noreferrer" />}>
                View in store
              </Button>
            )}
            {item && (
              <ConfirmAction
                action={deleteItemAction} fields={{ id: item.id }}
                trigger={<Button variant="destructive">Delete</Button>}
                title={`Delete ${item.title}?`}
                description="It comes off the storefront and its photos are deleted. This can't be undone."
                confirm="Delete piece"
              />
            )}
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
