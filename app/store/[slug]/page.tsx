import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Monogram } from '@/features/catalog/components/gallery';
import { getPublishedItem, getPublishedItems } from '@/features/catalog/queries';
import { enquire, storeUrl } from '@/features/catalog/store';
import { mrp, weight } from '@/lib/format';
import { imageBase } from '@/lib/r2';

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getPublishedItems()).map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: PageProps<'/store/[slug]'>): Promise<Metadata> {
  const item = await getPublishedItem((await params).slug);
  if (!item) return {};
  const base = imageBase();
  return {
    title: item.title,
    description: item.description ?? `${item.title} — ${item.category}`,
    openGraph: base && item.images[0] ? { images: [`${base}/${item.images[0]}`] } : undefined,
  };
}

export default async function PiecePage({ params }: PageProps<'/store/[slug]'>) {
  const item = await getPublishedItem((await params).slug);
  if (!item) notFound();
  const base = imageBase();
  const photos = base ? item.images.map((k) => `${base}/${k}`) : [];

  // The rows of the printed piece card, in its order; blanks are left off.
  const specs: [string, string | null][] = [
    ['Category', item.category],
    ['Gross weight', item.grossWtG !== null ? weight(item.grossWtG, 'g') : null],
    ['Diamond type', item.stoneType],
    ['Diamond weight', item.diamondWtCt !== null ? weight(item.diamondWtCt, 'ct') : null],
    ['Diamond quality', item.quality],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← All pieces
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        {/* Swipe through on a phone; a grid with the cover across the top on desktop. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto sm:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible">
          {photos.length === 0 ? (
            <div className="relative aspect-[4/5] w-full shrink-0 bg-muted lg:col-span-2"><Monogram /></div>
          ) : photos.map((src, i) => (
            <div
              key={src}
              className={`relative aspect-[4/5] w-[88%] shrink-0 snap-center bg-muted sm:w-full lg:w-auto ${i === 0 ? 'lg:col-span-2' : ''}`}
            >
              <Image
                src={src} alt={i === 0 ? item.title : ''} fill priority={i === 0}
                sizes={i === 0 ? '(min-width: 1024px) 55vw, 90vw' : '(min-width: 1024px) 28vw, 90vw'}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-medium leading-[1.02] tracking-[-0.01em] sm:text-5xl">{item.title}</h1>
            {item.mrp !== null && (
              <div className="text-lg tabular-nums">
                {mrp(item.mrp)} <span className="text-xs text-muted-foreground">MRP</span>
              </div>
            )}
          </div>
          <Button
            nativeButton={false} size="lg" className="h-12 w-full text-sm tracking-[0.06em] uppercase"
            render={
              <a
                href={enquire(`Hi, I'd like to know more about ${item.title}: ${storeUrl(`/${item.slug}`)}`)}
                target="_blank" rel="noopener noreferrer"
              />
            }
          >
            Enquire on WhatsApp
          </Button>
          {item.description && (
            <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{item.description}</p>
          )}
          <dl className="divide-y border-y text-sm">
            {specs.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
