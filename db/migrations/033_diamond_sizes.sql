-- Diamond size chart, ported from the Medusa jewellery pricing master (minus
-- markups: this book does not price from it). Per shape, carat bands such as
-- RD-100 = 0.975 to under 1.025 ct, each with an estimated face-up size.
-- A reference chart: lots are still identified by sieve / mm, nothing here is
-- enforced on them.
--
-- Superseded by 034 (the chart becomes stock identity). Kept as applied:
-- a migration that has run anywhere is never edited.

-- ------------------------------------------------------------ shape anchors
-- A shape's Size ID prefix (RD in RD-100) and the face-up size of a 1 ct stone
-- of it. Every size's mm is scaled from that: carat is proportional to volume,
-- and length to volume^(1/3), so mm = 1 ct mm x ct^(1/3). L/W is the ratio.
-- On the shape row itself, like uses_sieve: a second shape table would be a
-- second place to add every shape.
ALTER TABLE diamond_attributes ADD COLUMN IF NOT EXISTS prefix    text;
ALTER TABLE diamond_attributes ADD COLUMN IF NOT EXISTS length_mm numeric(6,2);
ALTER TABLE diamond_attributes ADD COLUMN IF NOT EXISTS width_mm  numeric(6,2);
ALTER TABLE diamond_attributes
  ADD CONSTRAINT shape_ref_only CHECK (
    attribute_type = 'shape' OR (prefix IS NULL AND length_mm IS NULL AND width_mm IS NULL)),
  ADD CONSTRAINT shape_prefix_format CHECK (prefix ~ '^[A-Z]{2,3}$'),
  ADD CONSTRAINT shape_anchor_pair CHECK (
    (length_mm IS NULL) = (width_mm IS NULL) AND (length_mm IS NULL OR (length_mm > 0 AND width_mm > 0)));
CREATE UNIQUE INDEX IF NOT EXISTS diamond_shape_prefix_uniq
  ON diamond_attributes (prefix) WHERE prefix IS NOT NULL;

-- Medusa's starter references (workbook Setup sheet) for the shapes both share.
UPDATE diamond_attributes d SET prefix = v.prefix, length_mm = v.l, width_mm = v.w
FROM (VALUES
  ('Round','RD',6.4,6.4), ('Pear','PR',8.5,5.5), ('Oval','OV',8.0,5.5),
  ('Cushion','CU',6.5,5.5), ('Marquise','MQ',10.0,5.3), ('Radiant','RA',6.0,5.5),
  ('Emerald','EM',6.5,5.0), ('Princess','PC',5.5,5.5)
) AS v(shape, prefix, l, w)
WHERE d.attribute_type = 'shape' AND d.value = v.shape;

-- ------------------------------------------------------------------- sizes
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS diamond_sizes (
  -- The Size ID itself (RD-100): permanent, so it is the primary key.
  id            text PRIMARY KEY CHECK (id ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  -- RESTRICT (the default): a shape with sizes cannot be removed from the master.
  shape_id      uuid NOT NULL REFERENCES diamond_attributes(id),
  min_ct        numeric(6,3) NOT NULL,
  max_ct        numeric(6,3) NOT NULL,
  nominal_ct    numeric(6,3) NOT NULL,
  -- Estimated from the shape's anchor, or the supplier's measured size.
  est_length_mm numeric(6,2) NOT NULL CHECK (est_length_mm > 0),
  est_width_mm  numeric(6,2) NOT NULL CHECK (est_width_mm > 0),
  notes         text,
  CHECK (min_ct >= 0.05 AND max_ct <= 3 AND min_ct < max_ct
         AND nominal_ct >= min_ct AND nominal_ct <= max_ct),
  -- Bands of one shape never overlap, so a stone's carat points to one size.
  -- Lower bound inclusive, upper exclusive -- except a closed band, whose
  -- nominal is its upper bound (the grid's top band, 1.975 to 2.000 ct).
  -- An exclusion constraint, not an app check: two saves at once cannot both
  -- pass a SELECT-then-INSERT check, but they cannot both pass this.
  EXCLUDE USING gist (
    shape_id WITH =,
    numrange(min_ct, max_ct, CASE WHEN nominal_ct = max_ct THEN '[]' ELSE '[)' END) WITH &&
  )
);
