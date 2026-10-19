'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { mrp } from '@/lib/format';

export type GalleryItem = {
  slug: string; title: string; category: string; mrp: number | null; cover: string | null;
};

/** The storefront grid. Filtering is client-side: the whole catalog is one page. */
export function Gallery({ items }: { items: GalleryItem[] }) {
  const categories = [...new Set(items.map((i) => i.category))];
  const [category, setCategory] = useState('');
  const shown = category ? items.filter((i) => i.category === category) : items;

  return (
    <div className="space-y-8">
      {categories.length > 1 && (
        <ToggleGroup
          value={[category]} onValueChange={(v) => setCategory(v[0] ?? '')}
          variant="outline" size="sm" className="mx-auto flex-wrap justify-center"
        >
          <ToggleGroupItem value="">All</ToggleGroupItem>
          {categories.map((c) => <ToggleGroupItem key={c} value={c}>{c}</ToggleGroupItem>)}
        </ToggleGroup>
      )}

      {shown.length === 0 ? (
        <Empty><EmptyDescription>New pieces are on their way.</EmptyDescription></Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
          {shown.map((it, i) => (
            <li key={it.slug}>
              <Link href={`/${it.slug}`} className="group block space-y-3">
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  {it.cover && (
                    <Image
                      src={it.cover} alt={it.title} fill priority={i < 3}
                      sizes="(min-width: 1024px) 33vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="space-y-1 text-center">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{it.category}</div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg leading-snug">{it.title}</h2>
                  {it.mrp !== null && <div className="text-sm tabular-nums">{mrp(it.mrp)}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
