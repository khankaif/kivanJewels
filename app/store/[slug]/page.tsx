import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { getPublishedItem, getPublishedItems } from '@/features/catalog/queries';
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
    <div className="space-y-6">
      <Link href="/" className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">
        ← All pieces
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
        <div className="grid grid-cols-2 gap-2">
          {photos.map((src, i) => (
            <div key={src} className={`relative aspect-[4/5] bg-muted ${i === 0 ? 'col-span-2' : ''}`}>
              <Image
                src={src} alt={i === 0 ? item.title : ''} fill priority={i === 0}
                sizes={i === 0 ? '(min-width: 1024px) 55vw, 100vw' : '(min-width: 1024px) 28vw, 50vw'}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{item.category}</div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight sm:text-4xl">{item.title}</h1>
            {item.mrp !== null && (
              <div className="text-lg tabular-nums">
                {mrp(item.mrp)} <span className="text-xs text-muted-foreground">MRP</span>
              </div>
            )}
          </div>
          {item.description && (
            <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{item.description}</p>
          )}
          <Separator />
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            {specs.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
