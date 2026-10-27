import { Gallery } from '@/features/catalog/components/gallery';
import { getPublishedItems } from '@/features/catalog/queries';
import { HEADLINE } from '@/features/catalog/store';
import { imageBase } from '@/lib/r2';

// Static, rebuilt hourly and on every catalog save (revalidatePath in the
// catalog actions), so visitors never wait on the database.
export const revalidate = 3600;

export default async function StorePage() {
  const base = imageBase();
  const items = await getPublishedItems();
  const url = (k: string | undefined) => (base && k ? `${base}/${k}` : null);
  return (
    <>
      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-8 sm:py-32">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fine jewellery</p>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-5xl font-medium leading-[1.02] tracking-[-0.01em] sm:text-7xl">
            {HEADLINE}
          </h1>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <Gallery
          items={items.map((i) => ({
            slug: i.slug, title: i.title, category: i.category, mrp: i.mrp,
            cover: url(i.images[0]), hover: url(i.images[1]),
          }))}
        />
      </div>
    </>
  );
}
