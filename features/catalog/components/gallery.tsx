'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { mrp } from '@/lib/format';

export type GalleryItem = {
  slug: string; title: string; category: string; mrp: number | null;
  /** The cover, and the second photo shown on hover. */
  cover: string | null; hover: string | null;
};

/** The storefront grid. Filtering is client-side: the whole catalog is one page. */
export function Gallery({ items }: { items: GalleryItem[] }) {
  const categories = [...new Set(items.map((i) => i.category))];
  const [category, setCategory] = useState('');
  const shown = category ? items.filter((i) => i.category === category) : items;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {categories.length > 1 ? (
          <ToggleGroup value={[category]} onValueChange={(v) => setCategory(v[0] ?? '')} className="flex-wrap">
            {[['', 'All'], ...categories.map((c) => [c, c])].map(([v, label]) => (
              <ToggleGroupItem
                key={v} value={v}
                className="h-8 px-0 pr-5 text-sm font-normal text-muted-foreground hover:bg-transparent aria-pressed:bg-transparent aria-pressed:text-foreground aria-pressed:underline underline-offset-8"
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : <span />}
        <span className="text-sm text-muted-foreground">
          {shown.length} {shown.length === 1 ? 'piece' : 'pieces'}
        </span>
      </div>

      {shown.length === 0 ? (
        <Empty><EmptyDescription>New pieces are on their way.</EmptyDescription></Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((it, i) => (
            <li key={it.slug}>
              <Link href={`/${it.slug}`} className="group block space-y-3">
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  {it.cover ? (
                    <>
                      <Image
                        src={it.cover} alt={it.title} fill priority={i < 4}
                        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                      {it.hover && (
                        <Image
                          src={it.hover} alt="" fill
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                          className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        />
                      )}
                    </>
                  ) : <Monogram />}
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-medium">{it.title}</h2>
                    <div className="text-xs text-muted-foreground">{it.category}</div>
                  </div>
                  {it.mrp !== null && <div className="shrink-0 text-sm tabular-nums">{mrp(it.mrp)}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Stands in for a piece's photo until one is uploaded. */
export function Monogram() {
  return (
    <div className="absolute inset-0 grid place-items-center font-display text-6xl text-muted-foreground/30">K</div>
  );
}
