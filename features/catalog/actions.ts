'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/db/client';
import { requireUser } from '@/lib/auth/server';
import { slugify } from '@/lib/normalize';
import { UUID } from './queries';
import { IMAGE_KEY, IMAGE_TYPES, presignUpload, removeImages } from '@/lib/r2';

export type CatalogState = { error: string } | { ok: string } | null;

/** Both the admin list and every storefront page read the catalog. */
function refresh() {
  revalidatePath('/catalog');
  revalidatePath('/store', 'layout');
}

export async function uploadUrlAction(contentType: string): Promise<{ key: string; url: string } | { error: string }> {
  await requireUser();
  if (!IMAGE_TYPES.includes(contentType)) return { error: 'Use a JPEG, PNG, WebP or AVIF photo.' };
  try {
    return await presignUpload(contentType);
  } catch (e) {
    console.error(e);
    return { error: 'Photo storage is not set up yet. Ask an admin to add the R2 settings.' };
  }
}

export async function saveItemAction(_prev: CatalogState, form: FormData): Promise<CatalogState> {
  await requireUser();
  const text = (k: string) => String(form.get(k) ?? '').trim() || null;
  const amount = (k: string, label: string): number | null | string => {
    const raw = text(k);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : `${label} must be a number, zero or more.`;
  };

  const id = text('id');
  const title = text('title');
  const category = text('category');
  if (!title) return { error: 'Give the piece a title.' };
  if (!category) return { error: 'Pick a category.' };
  if (id && !UUID.test(id)) return { error: 'Unknown piece.' };

  const grossWt = amount('grossWtG', 'Gross weight');
  const diamondWt = amount('diamondWtCt', 'Diamond weight');
  const mrp = amount('mrp', 'MRP');
  for (const v of [grossWt, diamondWt, mrp]) if (typeof v === 'string') return { error: v };

  const images = form.getAll('images').map(String);
  if (images.some((k) => !IMAGE_KEY.test(k))) return { error: 'One of the photos is not from this catalog.' };
  const published = form.get('published') === 'on';
  if (published && !images.length) return { error: 'Add at least one photo before publishing.' };

  const f = {
    title, description: text('description'), category, stoneType: text('stoneType'),
    quality: text('quality'), grossWt, diamondWt, mrp, images, published,
  };

  if (id) {
    const [old] = await sql`SELECT images FROM catalog_items WHERE id = ${id}::uuid`;
    if (!old) return { error: 'That piece no longer exists.' };
    await sql`
      UPDATE catalog_items SET
        title = ${f.title}, description = ${f.description}, category = ${f.category},
        stone_type = ${f.stoneType}, quality = ${f.quality}, gross_wt_g = ${f.grossWt},
        diamond_wt_ct = ${f.diamondWt}, mrp = ${f.mrp}, images = ${f.images},
        published = ${f.published}, updated_at = now()
      WHERE id = ${id}::uuid`;
    await removeImages((old.images as string[]).filter((k) => !images.includes(k)));
  } else {
    const base = slugify(title) || 'piece';
    // A second "Solitaire Ring" gets a short suffix rather than an error.
    await sql`
      INSERT INTO catalog_items (slug, title, description, category, stone_type, quality,
                                 gross_wt_g, diamond_wt_ct, mrp, images, published)
      VALUES (
        ${base} || CASE WHEN EXISTS (SELECT 1 FROM catalog_items WHERE slug = ${base})
                        THEN '-' || substr(md5(random()::text), 1, 5) ELSE '' END,
        ${f.title}, ${f.description}, ${f.category}, ${f.stoneType}, ${f.quality},
        ${f.grossWt}, ${f.diamondWt}, ${f.mrp}, ${f.images}, ${f.published})`;
  }
  refresh();
  redirect('/catalog');
}

export async function setPublishedAction(form: FormData): Promise<void> {
  await requireUser();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  // Same rule as the form: nothing goes public without a photo.
  await sql`
    UPDATE catalog_items SET published = ${form.get('published') === '1'}, updated_at = now()
    WHERE id = ${id}::uuid AND (cardinality(images) > 0 OR ${form.get('published') !== '1'})`;
  refresh();
}

export async function deleteItemAction(form: FormData): Promise<void> {
  await requireUser();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  const [gone] = await sql`DELETE FROM catalog_items WHERE id = ${id}::uuid RETURNING images`;
  if (gone) await removeImages(gone.images as string[]);
  refresh();
  redirect('/catalog');
}
