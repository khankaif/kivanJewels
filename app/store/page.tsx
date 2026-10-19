import { Gallery } from '@/features/catalog/components/gallery';
import { getPublishedItems } from '@/features/catalog/queries';
import { imageBase } from '@/lib/r2';

// Static, rebuilt hourly and on every catalog save (revalidatePath in the
// catalog actions), so visitors never wait on the database.
export const revalidate = 3600;

export default async function StorePage() {
  const base = imageBase();
  const items = await getPublishedItems();
  return (
    <Gallery
      items={items.map((i) => ({
        slug: i.slug, title: i.title, category: i.category, mrp: i.mrp,
        cover: base && i.images[0] ? `${base}/${i.images[0]}` : null,
      }))}
    />
  );
}
