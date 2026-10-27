import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db/client';
import {
  getCatalogItem, getCatalogItems, getPublishedItem, getPublishedItems,
} from '@/features/catalog/queries';

/** The storefront is public: a draft reaching it is the one failure that matters. */
test('drafts never reach the storefront reads', async () => {
  const tag = `zz-test-${Date.now()}`;
  const images = [`catalog/${crypto.randomUUID()}.jpg`, `catalog/${crypto.randomUUID()}.webp`];
  const rows = await sql`
    INSERT INTO catalog_items (slug, title, category, mrp, gross_wt_g, images, published) VALUES
      (${`${tag}-live`},  'Live piece',  'Gold Vermeil Jewelry', 45000, 3.25, ${images}, true),
      (${`${tag}-draft`}, 'Draft piece', 'Gold Vermeil Jewelry', null, null, ${[]}, false)
    RETURNING id, slug`;
  try {
    const live = await getPublishedItems();
    assert.ok(live.some((i) => i.slug === `${tag}-live`));
    assert.ok(!live.some((i) => i.slug === `${tag}-draft`));
    assert.equal(await getPublishedItem(`${tag}-draft`), null);

    const one = await getPublishedItem(`${tag}-live`);
    assert.deepEqual(one?.images, images, 'photo order survives the round trip');
    assert.equal(one?.mrp, 45000);
    assert.equal(one?.grossWtG, 3.25);

    // Staff still see the draft.
    assert.ok((await getCatalogItems()).some((i) => i.slug === `${tag}-draft`));
    const draft = rows.find((r: any) => r.slug === `${tag}-draft`);
    assert.ok(draft);
    assert.equal((await getCatalogItem(draft.id))?.published, false);
  } finally {
    await sql`DELETE FROM catalog_items WHERE slug LIKE ${`${tag}-%`}`;
  }
});
