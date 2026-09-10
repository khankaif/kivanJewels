-- The stone master, completed: type, colour, clarity, shape, sieve, mm, and
-- now certification. Three things move at once, because they are one problem.
--
-- 1. Stone type was NOT part of stock identity. lot_unit_key() keyed on
--    shape|sieve|mm|colour|clarity, so a Natural parcel bought into a spec you
--    already held as Lab Grown would merge into that unit and average the two
--    cost rates into a price that is true of neither. Eight specs in the book
--    already carry both kinds -- round 2.5-3 / 1.3mm / EF / VVS-VS alone spans
--    51 lots. Adding type to the key can only SPLIT units, never merge them,
--    so the unique index cannot be violated by this change.
-- 2. Certified goods are not the same goods. An IGI-certified parcel sells at
--    a different price from the same spec uncertified, so certification and
--    the lab that issued it are identity, not decoration.
-- 3. The master lists were seeded by hand and never matched the book: six
--    spellings of two stone types, 'RBC' beside 'Round'. Values now come from
--    the master or from an alias that maps to one; nothing else is accepted.

-- ----------------------------------------------------------------- aliases
-- What the book already says, mapped to what the master calls it. Used once
-- below to rectify existing rows, and on every write from here on.
CREATE TABLE IF NOT EXISTS attribute_aliases (
  bucket text NOT NULL REFERENCES attribute_buckets(key) ON UPDATE CASCADE,
  alias  text NOT NULL,          -- lowercased, trimmed
  value  text NOT NULL,          -- the canonical master value
  PRIMARY KEY (bucket, alias)
);

INSERT INTO attribute_buckets (key, label, sort_order, is_preset) VALUES
  ('certified','Certified', 6, true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO diamond_attributes (attribute_type, value, sort_order) VALUES
  ('certified','Certified',1), ('certified','Non-certified',2),
  ('stone_type','Gemstone',3)
ON CONFLICT DO NOTHING;

INSERT INTO attribute_aliases (bucket, alias, value) VALUES
  ('stone_type','lab grown diamond','Lab Grown'),
  ('stone_type','lab grown','Lab Grown'),
  ('stone_type','lgd','Lab Grown'),
  ('stone_type','natural diamond','Natural'),
  ('stone_type','natural','Natural'),
  ('stone_type','gemstone','Gemstone'),
  ('shape','rbc','Round'),
  ('shape','mq','Marquise'),
  ('shape','trapezoids','Trapezoid'),
  ('certified','cert','Certified'),
  ('certified','non cert','Non-certified'),
  ('certified','non-cert','Non-certified'),
  ('certified','no','Non-certified'),
  ('certified','yes','Certified')
ON CONFLICT DO NOTHING;

-- Resolves a raw value to its master value: exact, case-insensitive, or alias.
-- NULL means the value is not in the master and cannot be stored.
CREATE OR REPLACE FUNCTION master_value(bucket_key text, raw text) RETURNS text AS $$
  SELECT COALESCE(
    (SELECT d.value FROM diamond_attributes d
      WHERE d.attribute_type = bucket_key AND lower(btrim(d.value)) = lower(btrim(raw)) LIMIT 1),
    (SELECT a.value FROM attribute_aliases a
      WHERE a.bucket = bucket_key AND a.alias = lower(btrim(raw)) LIMIT 1)
  );
$$ LANGUAGE sql STABLE;

-- --------------------------------------------------------- rectify the book
-- Every stored value that the master can recognise is rewritten to the master
-- spelling. Anything it cannot recognise is left alone and surfaces in the
-- Masters mismatch screen rather than being silently discarded.
ALTER TABLE lots ADD COLUMN IF NOT EXISTS lab text;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS certified text;
ALTER TABLE requirement_lines ADD COLUMN IF NOT EXISTS lab text;
ALTER TABLE requirement_lines ADD COLUMN IF NOT EXISTS certified text;

UPDATE lots SET stone_type = master_value('stone_type', stone_type)
 WHERE master_value('stone_type', stone_type) IS DISTINCT FROM stone_type
   AND master_value('stone_type', stone_type) IS NOT NULL;
UPDATE lots SET shape = master_value('shape', shape)
 WHERE master_value('shape', shape) IS DISTINCT FROM shape
   AND master_value('shape', shape) IS NOT NULL;
UPDATE lots SET colour = master_value('colour', colour)
 WHERE master_value('colour', colour) IS DISTINCT FROM colour
   AND master_value('colour', colour) IS NOT NULL;
UPDATE lots SET clarity = master_value('clarity', clarity)
 WHERE master_value('clarity', clarity) IS DISTINCT FROM clarity
   AND master_value('clarity', clarity) IS NOT NULL;

UPDATE requirement_lines SET stone_type = master_value('stone_type', stone_type)
 WHERE master_value('stone_type', stone_type) IS NOT NULL;
UPDATE requirement_lines SET shape = master_value('shape', shape)
 WHERE master_value('shape', shape) IS DISTINCT FROM shape
   AND master_value('shape', shape) IS NOT NULL;

-- ------------------------------------------------------------- new identity
CREATE OR REPLACE FUNCTION spec_type(t text) RETURNS text AS $$
  SELECT lower(btrim(t));
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION spec_lab(t text) RETURNS text AS $$
  SELECT upper(btrim(t));
$$ LANGUAGE sql IMMUTABLE STRICT;

-- Certification is a yes/no in the key: an uncertified stone has no lab, and
-- 'Certified' with IGI is a different unit from 'Certified' with HRD.
CREATE OR REPLACE FUNCTION spec_certified(t text) RETURNS text AS $$
  SELECT CASE WHEN lower(btrim(t)) IN ('certified','cert','yes','y','true') THEN 'certified'
              WHEN t IS NULL OR btrim(t) = '' THEN ''
              ELSE 'non-certified' END;
$$ LANGUAGE sql IMMUTABLE;

DROP VIEW IF EXISTS requirement_line_status;
DROP INDEX IF EXISTS lots_unit_uniq;
DROP INDEX IF EXISTS requirement_lines_unit_idx;
ALTER TABLE lots              DROP COLUMN IF EXISTS unit_key;
ALTER TABLE requirement_lines DROP COLUMN IF EXISTS unit_key;
DROP FUNCTION IF EXISTS lot_unit_key(text, text, text, text, text);

CREATE FUNCTION lot_unit_key(
  stone_type text, shape text, sieve text, mm text,
  colour text, clarity text, lab text, certified text
) RETURNS text AS $$
  SELECT COALESCE(spec_type(stone_type),    '') || '|' ||
         COALESCE(spec_shape(shape),        '') || '|' ||
         COALESCE(spec_sieve(sieve),        '') || '|' ||
         COALESCE(spec_mm(mm),              '') || '|' ||
         COALESCE(spec_colour(colour),      '') || '|' ||
         COALESCE(spec_clarity(clarity),    '') || '|' ||
         COALESCE(spec_lab(lab),            '') || '|' ||
         COALESCE(spec_certified(certified),'');
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE lots ADD COLUMN unit_key text
  GENERATED ALWAYS AS (lot_unit_key(stone_type, shape, sieve_size, mm_size,
                                    colour, clarity, lab, certified)) STORED;
CREATE UNIQUE INDEX lots_unit_uniq ON lots (unit_key) WHERE source = 'unit';

ALTER TABLE requirement_lines ADD COLUMN unit_key text
  GENERATED ALWAYS AS (lot_unit_key(stone_type, shape, sieve_size, mm_size,
                                    colour, clarity, lab, certified)) STORED;
CREATE INDEX requirement_lines_unit_idx ON requirement_lines (unit_key) WHERE status = 'open';

-- --------------------------------------------------------------- the rules
ALTER TABLE spec_field_rules DROP CONSTRAINT IF EXISTS spec_field_rules_field_check;
ALTER TABLE spec_field_rules ADD CONSTRAINT spec_field_rules_field_check
  CHECK (field IN ('stoneType','shape','sieveSize','mmSize','colour','clarity','lab','certified'));

INSERT INTO spec_field_rules (shape_value, field, mode) VALUES
  ('*','certified','required'),
  -- The lab only exists once the stone is certified; the forms hide it until
  -- then, which is a relation between two fields rather than a shape rule.
  ('*','lab','optional')
ON CONFLICT DO NOTHING;

-- Rebuilt after the generated column was replaced; carries the two new fields.
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
  rl.stone_type, rl.shape, rl.sieve_size, rl.mm_size, rl.colour, rl.clarity,
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
