-- The jewellery catalog: finished pieces shown on the public storefront.
--
-- Not stock. A piece here is a display record -- title, photos, the weights
-- printed on its card and an MRP. Nothing in the ledger reads it, so it can be
-- edited freely without touching the books.
CREATE TABLE IF NOT EXISTS catalog_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The storefront URL. Set once from the first title and never rewritten, so a
  -- shared link keeps working after the title is polished.
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text NOT NULL CHECK (btrim(title) <> ''),
  description   text,
  category      text NOT NULL,                       -- master: jewellery_category
  stone_type    text,                                -- master: stone_type
  gross_wt_g    numeric(8,3)  CHECK (gross_wt_g    >= 0),
  diamond_wt_ct numeric(10,3) CHECK (diamond_wt_ct >= 0),
  quality       text,                                -- as printed: 'VVS-VS-EF'
  mrp           numeric(12,2) CHECK (mrp >= 0),
  -- R2 object keys in display order; the first is the cover. Keys, not URLs,
  -- so the image domain can change without rewriting rows.
  images        text[] NOT NULL DEFAULT '{}',
  published     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text DEFAULT NULLIF(current_setting('app.actor', true), '')
);

CREATE INDEX IF NOT EXISTS catalog_items_published_idx
  ON catalog_items (created_at DESC) WHERE published;

-- Categories are a master list like shape or colour, managed on the same page.
-- Preset because the catalog form is wired to it by key.
INSERT INTO attribute_buckets (key, label, sort_order, is_preset)
VALUES ('jewellery_category', 'Jewellery category',
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM attribute_buckets), true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO diamond_attributes (attribute_type, value, sort_order)
VALUES ('jewellery_category', 'Gold Vermeil Jewelry', 1)
ON CONFLICT DO NOTHING;
