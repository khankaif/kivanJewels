-- The size chart becomes how stock is identified, and the attribute master goes.
--
-- Ported from the Medusa jewellery pricing master (minus markups): per shape,
-- carat-per-stone bands such as RD-100 = 0.975 to under 1.025 ct, each with an
-- estimated face-up size. A parcel is now "Lab Grown RD-100 EF VVS", not
-- "Lab Grown Round 6.4mm EF VVS": the size replaces the typed sieve and mm,
-- and the shape follows from the size.
--
-- Upgrades 033's chart in place: its shapes (anchors on diamond_attributes)
-- move to their own table, and its sizes are carried over, not regenerated.
--
-- Grades (type, colour, clarity, lab, certification) become fixed lists in
-- code (lib/spec-rules.ts), so diamond_attributes, its buckets, its aliases
-- and master_value() are dropped.

-- Sieve and mm are dropped, not converted: no rule maps "+2.5-3" to a carat
-- band, and dropping them would merge parcels that differed only by size.
-- So this runs on an empty book (the client starts clean) or not at all.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM lots) OR EXISTS (SELECT 1 FROM requirement_lines) THEN
    RAISE EXCEPTION 'Migration 034 replaces sieve/mm with chart sizes and needs an empty book: wipe stock and sales first.';
  END IF;
END $$;

-- ------------------------------------------------------------------ shapes
-- Size ID prefix (RD in RD-100) and the face-up size of a 1 ct stone. Every
-- size's estimated mm scales from it: carat is proportional to volume, length
-- to volume^(1/3), so mm = 1 ct mm x ct^(1/3). L/W is the shape's ratio.
-- Its own table now: diamond_attributes, where 033 put them, is dropped below.
CREATE TABLE diamond_shapes (
  shape      text PRIMARY KEY CHECK (shape ~ '^\S(.{0,28}\S)?$'),
  prefix     text NOT NULL UNIQUE CHECK (prefix ~ '^[A-Z]{2,3}$'),
  length_mm  numeric(6,2),
  width_mm   numeric(6,2),
  sort_order int NOT NULL DEFAULT 0,
  CHECK ((length_mm IS NULL) = (width_mm IS NULL)
         AND (length_mm IS NULL OR (length_mm > 0 AND width_mm > 0)))
);
-- Every shape 033 gave a prefix: the starter eight, plus any the owner set up.
INSERT INTO diamond_shapes (shape, prefix, length_mm, width_mm, sort_order)
SELECT value, prefix, length_mm, width_mm, sort_order
FROM diamond_attributes WHERE attribute_type = 'shape' AND prefix IS NOT NULL;

-- ------------------------------------------------------------------- sizes
-- 033's sizes pointed at a diamond_attributes row; set them aside by shape
-- name, rebuild the table on diamond_shapes, and put them back.
CREATE TEMP TABLE sizes_033 ON COMMIT DROP AS
SELECT s.id, d.value AS shape, s.min_ct, s.max_ct, s.nominal_ct,
       s.est_length_mm, s.est_width_mm, s.notes
FROM diamond_sizes s JOIN diamond_attributes d ON d.id = s.shape_id;
DROP TABLE diamond_sizes;

CREATE TABLE diamond_sizes (
  -- The Size ID itself: permanent, so it is the primary key.
  id            text PRIMARY KEY CHECK (id ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  shape         text NOT NULL REFERENCES diamond_shapes(shape) ON UPDATE CASCADE,
  -- Carats PER STONE. From 0.001 so melee bands fit: most parcels here are
  -- far below the 0.05 ct the jewellery chart started at.
  min_ct        numeric(7,4) NOT NULL,
  max_ct        numeric(7,4) NOT NULL,
  nominal_ct    numeric(7,4) NOT NULL,
  est_length_mm numeric(6,2) NOT NULL CHECK (est_length_mm > 0),
  est_width_mm  numeric(6,2) NOT NULL CHECK (est_width_mm > 0),
  notes         text,
  CHECK (min_ct >= 0.001 AND max_ct <= 3 AND min_ct < max_ct
         AND nominal_ct >= min_ct AND nominal_ct <= max_ct),
  -- Target of the lots' (size_id, shape) foreign key below.
  UNIQUE (id, shape),
  -- Bands of one shape never overlap, so a stone's carat points to one size.
  -- Lower bound inclusive, upper exclusive -- except a closed band, whose
  -- nominal is its upper bound (the grid's top band, 1.975 to 2.000 ct).
  -- An exclusion constraint, not an app check: two saves at once cannot both
  -- pass a SELECT-then-INSERT check, but they cannot both pass this.
  EXCLUDE USING gist (
    shape WITH =,
    numrange(min_ct, max_ct, CASE WHEN nominal_ct = max_ct THEN '[]' ELSE '[)' END) WITH &&
  )
);
INSERT INTO diamond_sizes SELECT * FROM sizes_033;

-- ------------------------------------------- stock identity: size, not sieve
-- Every view that names a spec column is rebuilt; dependants first.
DROP VIEW requirement_pipeline;
DROP VIEW requirement_line_status;
DROP VIEW bill_trail;
DROP VIEW movement_entries;
DROP VIEW memo_line_status;
DROP VIEW lot_balances;

DROP INDEX IF EXISTS lots_unit_uniq;
DROP INDEX IF EXISTS requirement_lines_unit_idx;
ALTER TABLE lots              DROP COLUMN unit_key;
ALTER TABLE requirement_lines DROP COLUMN unit_key;
DROP FUNCTION lot_unit_key(text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS spec_sieve(text);
DROP FUNCTION IF EXISTS spec_mm(text);

-- shape stays on the row (every list shows it) but can no longer disagree with
-- the size: the composite foreign key makes the database hold them together,
-- and renaming a shape cascades into both columns at once.
ALTER TABLE lots
  DROP COLUMN sieve_size, DROP COLUMN mm_size,
  ADD COLUMN size_id text,
  ADD FOREIGN KEY (size_id, shape) REFERENCES diamond_sizes(id, shape) ON UPDATE CASCADE;
ALTER TABLE requirement_lines
  DROP COLUMN sieve_size, DROP COLUMN mm_size,
  ADD COLUMN size_id text,
  ADD FOREIGN KEY (size_id, shape) REFERENCES diamond_sizes(id, shape) ON UPDATE CASCADE;

CREATE FUNCTION lot_unit_key(
  stone_type text, shape text, size_id text,
  colour text, clarity text, lab text, certified text
) RETURNS text AS $$
  SELECT COALESCE(spec_type(stone_type),    '') || '|' ||
         COALESCE(spec_shape(shape),        '') || '|' ||
         COALESCE(upper(btrim(size_id)),    '') || '|' ||
         COALESCE(spec_colour(colour),      '') || '|' ||
         COALESCE(spec_clarity(clarity),    '') || '|' ||
         COALESCE(spec_lab(lab),            '') || '|' ||
         COALESCE(spec_certified(certified),'');
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE lots ADD COLUMN unit_key text
  GENERATED ALWAYS AS (lot_unit_key(stone_type, shape, size_id, colour, clarity, lab, certified)) STORED;
CREATE UNIQUE INDEX lots_unit_uniq ON lots (unit_key) WHERE source = 'unit';
ALTER TABLE requirement_lines ADD COLUMN unit_key text
  GENERATED ALWAYS AS (lot_unit_key(stone_type, shape, size_id, colour, clarity, lab, certified)) STORED;
CREATE INDEX requirement_lines_unit_idx ON requirement_lines (unit_key) WHERE status = 'open';

-- ------------------------------------------- the views, as before, with size
CREATE VIEW lot_balances AS
SELECT
  l.id                        AS lot_id,
  l.lot_no,
  l.stone_type, l.shape, l.size_id, l.clarity, l.colour,
  l.cost_rate,
  l.source,
  p.name                      AS party_name,
  COALESCE(SUM(m.carats), 0)  AS balance,
  COALESCE((
    SELECT SUM(ml.carats
               - COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
                           WHERE mv.memo_line_id = ml.id AND mv.kind = 'memo_out_return'), 0)
               - COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
                           WHERE b.memo_line_id = ml.id), 0))
    FROM memo_lines ml
    JOIN memos mo ON mo.id = ml.memo_id
    WHERE ml.lot_id = l.id AND ml.status = 'open' AND mo.direction = 'out'
  ), 0)                       AS exposure,
  l.lab,
  l.certified,
  l.unit_key
FROM lots l
LEFT JOIN parties p ON p.id = l.party_id
LEFT JOIN movements m ON m.lot_id = l.id
GROUP BY l.id, p.name;

CREATE VIEW memo_line_status AS
SELECT
  ml.id            AS line_id,
  ml.memo_id,
  m.direction,
  m.memo_no,
  m.party_id,
  p.name           AS party_name,
  m.issued_on::text AS issued_on,
  m.due_on::text    AS due_on,
  (m.status = 'open' AND m.due_on IS NOT NULL AND m.due_on < CURRENT_DATE) AS overdue,
  m.agent,
  m.status         AS memo_status,
  ml.lot_id,
  l.lot_no,
  l.stone_type,
  l.shape,
  l.size_id,
  ml.carats,
  ml.rate,
  ml.status        AS line_status,
  COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
            WHERE mv.memo_line_id = ml.id
              AND mv.kind IN ('memo_out_return','memo_in_return')), 0) AS returned,
  COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
            WHERE b.memo_line_id = ml.id), 0)                          AS billed,
  COALESCE((SELECT SUM(b.amount) FROM memo_line_billings b
            WHERE b.memo_line_id = ml.id), 0)                          AS billed_amount,
  ml.carats
    - COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
                WHERE mv.memo_line_id = ml.id
                  AND mv.kind IN ('memo_out_return','memo_in_return')), 0)
    - COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
                WHERE b.memo_line_id = ml.id), 0)                       AS outstanding
FROM memo_lines ml
JOIN memos   m ON m.id = ml.memo_id
JOIN parties p ON p.id = m.party_id
JOIN lots    l ON l.id = ml.lot_id;

CREATE VIEW movement_entries AS
SELECT
  m.id,
  m.moved_on::text                     AS moved_on,
  m.created_at,
  (m.carats < 0)                       AS is_outward,
  m.kind, m.carats, m.rate, m.amount, m.notes, m.ref_type, m.ref_id,
  l.id AS lot_id, l.lot_no, l.stone_type, l.shape, l.size_id,
  l.source AS lot_source,
  p.id AS party_id, p.name AS party_name,
  mo.memo_no, mo.direction AS memo_direction,
  (m.carats > 0)                       AS is_inward,
  SUM(m.carats) OVER (PARTITION BY m.lot_id
                      ORDER BY m.moved_on, (m.carats < 0), m.id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM movements m
JOIN lots l          ON l.id = m.lot_id
LEFT JOIN parties p  ON p.id = l.party_id
LEFT JOIN memo_lines ml ON ml.id = m.memo_line_id
LEFT JOIN memos mo   ON mo.id = ml.memo_id;

CREATE VIEW bill_trail AS
SELECT
  g.id                AS ledger_id,
  g.party_id,
  g.bill_no,
  g.kind,
  g.dated_on::text    AS dated_on,
  g.amount,
  g.notes,
  CASE WHEN g.kind IN ('sale_invoice','payment_in') THEN 'sale' ELSE 'purchase' END AS direction,
  m.memo_no,
  m.direction         AS memo_direction,
  m.issued_on::text   AS memo_issued_on,
  ml.carats           AS memo_line_carats,
  r.requirement_no,
  rp.name             AS requirement_party,
  COALESCE(lot.lot_no, memo_lot.lot_no)         AS lot_no,
  COALESCE(lot.stone_type, memo_lot.stone_type) AS stone_type,
  COALESCE(lot.shape, memo_lot.shape)           AS shape,
  COALESCE(lot.size_id, memo_lot.size_id)       AS size_id,
  COALESCE(lot.colour, memo_lot.colour)         AS colour,
  COALESCE(lot.clarity, memo_lot.clarity)       AS clarity,
  COALESCE(lot.lab, memo_lot.lab)               AS lab,
  COALESCE(lot.certified, memo_lot.certified)   AS certified
FROM ledger g
LEFT JOIN memo_lines        ml ON ml.id = g.memo_line_id
LEFT JOIN memos             m  ON m.id  = ml.memo_id
LEFT JOIN lots              memo_lot ON memo_lot.id = ml.lot_id
LEFT JOIN lots              lot ON lot.id = g.lot_id
LEFT JOIN requirement_lines rl ON rl.id = COALESCE(g.requirement_line_id, ml.requirement_line_id)
LEFT JOIN requirements      r  ON r.id  = rl.requirement_id
LEFT JOIN parties           rp ON rp.id = r.party_id;

CREATE VIEW requirement_line_status AS
WITH d AS (
  SELECT
    rl.id AS line_id,
    COALESCE((
      SELECT SUM(ml.carats
                 - COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
                             WHERE mv.memo_line_id = ml.id AND mv.kind = 'memo_out_return'), 0))
      FROM memo_lines ml JOIN memos mo ON mo.id = ml.memo_id
      WHERE ml.requirement_line_id = rl.id AND mo.direction = 'out'
    ), 0) AS delivered_memo,
    COALESCE((
      SELECT SUM(ABS(mv.carats)) FROM movements mv
      WHERE mv.kind = 'sale' AND mv.ref_type = 'requirement_line' AND mv.ref_id = rl.id::text
    ), 0) AS delivered_direct,
    COALESCE((
      SELECT SUM(mls.outstanding) FROM memo_line_status mls
      WHERE mls.direction = 'in'
        AND mls.line_id IN (SELECT id FROM memo_lines WHERE requirement_line_id = rl.id)
    ), 0) AS sourced_pending
  FROM requirement_lines rl
)
SELECT
  rl.id             AS line_id,
  rl.requirement_id,
  r.requirement_no,
  r.party_id,
  p.name            AS party_name,
  r.raised_on::text AS raised_on,
  r.agent,
  r.status          AS requirement_status,
  rl.stone_type, rl.shape, rl.size_id, rl.colour, rl.clarity,
  rl.lab, rl.certified,
  rl.unit_key,
  rl.carats         AS wanted,
  rl.quoted_rate,
  rl.status         AS line_status,
  d.delivered_memo,
  d.delivered_direct,
  d.sourced_pending,
  d.delivered_memo + d.delivered_direct              AS delivered,
  rl.carats - d.delivered_memo - d.delivered_direct  AS outstanding,
  rl.plan_stock,
  rl.plan_source
FROM requirement_lines rl
JOIN requirements r ON r.id = rl.requirement_id
JOIN parties      p ON p.id = r.party_id
JOIN d ON d.line_id = rl.id;

CREATE VIEW requirement_pipeline AS
WITH per_line AS (
  SELECT
    rls.requirement_id,
    rls.line_id,
    GREATEST(rls.outstanding, 0) AS outstanding,
    rls.sourced_pending,
    COALESCE((
      SELECT SUM(mls.outstanding) FROM memo_line_status mls
      WHERE mls.direction = 'out'
        AND mls.line_id IN (SELECT id FROM memo_lines WHERE requirement_line_id = rls.line_id)
    ), 0) AS on_approval,
    COALESCE((
      SELECT SUM(b.balance) FROM lot_balances b JOIN lots l ON l.id = b.lot_id
      WHERE l.unit_key = rls.unit_key AND b.balance > 0.0005
    ), 0) AS in_stock
  FROM requirement_line_status rls
  WHERE rls.line_status = 'open'
)
SELECT
  r.id, r.requirement_no, r.party_id, p.name AS party_name,
  r.raised_on::text AS raised_on, r.agent, r.status,
  (CURRENT_DATE - r.raised_on)::int          AS age_days,
  COALESCE(SUM(pl.outstanding), 0)           AS outstanding,
  COALESCE(SUM(pl.on_approval), 0)           AS on_approval,
  COALESCE(SUM(pl.sourced_pending), 0)       AS sourced_pending,
  COALESCE(bool_and(pl.in_stock >= pl.outstanding - 0.0005), true) AS covered,
  count(pl.line_id)::int                     AS open_lines,
  CASE
    WHEN COALESCE(SUM(pl.on_approval), 0) > 0.0005                     THEN 'approval'
    WHEN r.status = 'closed' OR COALESCE(SUM(pl.outstanding), 0) <= 0.0005 THEN 'closed'
    WHEN COALESCE(SUM(pl.sourced_pending), 0) > 0.0005                 THEN 'sourcing'
    WHEN bool_and(pl.in_stock >= pl.outstanding - 0.0005)              THEN 'ready'
    ELSE 'new'
  END AS stage
FROM requirements r
JOIN parties p ON p.id = r.party_id
LEFT JOIN per_line pl ON pl.requirement_id = r.id
GROUP BY r.id, r.requirement_no, r.party_id, p.name, r.raised_on, r.agent, r.status;

-- ------------------------------------------------ the attribute master goes
DROP FUNCTION IF EXISTS master_value(text, text);
DROP TABLE attribute_aliases;
DROP TABLE diamond_attributes;
DROP TABLE attribute_buckets;
