import { sql } from '@/db/client';

export type CatalogItem = {
  id: string; slug: string; title: string; description: string | null;
  category: string; stoneType: string | null;
  grossWtG: number | null; diamondWtCt: number | null;
  quality: string | null; mrp: number | null;
  /** R2 keys in display order; the first is the cover. */
  images: string[];
  published: boolean;
};

const num = (v: unknown) => (v === null ? null : Number(v));

const map = (r: any): CatalogItem => ({
  id: r.id, slug: r.slug, title: r.title, description: r.description,
  category: r.category, stoneType: r.stone_type,
  grossWtG: num(r.gross_wt_g), diamondWtCt: num(r.diamond_wt_ct),
  quality: r.quality, mrp: num(r.mrp), images: r.images, published: r.published,
});

/** Admin: every piece, drafts included, newest first. */
export async function getCatalogItems(): Promise<CatalogItem[]> {
  const rows = await sql`SELECT * FROM catalog_items ORDER BY created_at DESC`;
  return (rows as any[]).map(map);
}

export async function getCatalogItem(id: string): Promise<CatalogItem | null> {
  const [r] = await sql`SELECT * FROM catalog_items WHERE id = ${id}::uuid`;
  return r ? map(r) : null;
}

// Storefront reads. Every one filters on `published` itself rather than
// trusting a caller to: a draft must never reach the public site.

export async function getPublishedItems(): Promise<CatalogItem[]> {
  const rows = await sql`SELECT * FROM catalog_items WHERE published ORDER BY created_at DESC`;
  return (rows as any[]).map(map);
}

export async function getPublishedItem(slug: string): Promise<CatalogItem | null> {
  const [r] = await sql`SELECT * FROM catalog_items WHERE published AND slug = ${slug}`;
  return r ? map(r) : null;
}
