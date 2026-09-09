-- Colour and clarity belong in unit identity, not just on the label. Real
-- data shows the same shape/sieve/mm spanning 4-9 different colours, each
-- priced differently (EF and GH at 8.5-9/2.20mm are not the same stock).
-- Merging those by weighted average would blend two grades into one fake rate.

DROP INDEX IF EXISTS lots_unit_uniq;
ALTER TABLE lots DROP COLUMN unit_key;
DROP FUNCTION IF EXISTS lot_unit_key(text, text, text);

CREATE OR REPLACE FUNCTION spec_colour(t text) RETURNS text AS $$
  SELECT upper(btrim(t));
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION spec_clarity(t text) RETURNS text AS $$
  SELECT upper(btrim(t));
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE FUNCTION lot_unit_key(shape text, sieve text, mm text, colour text, clarity text) RETURNS text AS $$
  SELECT COALESCE(spec_shape(shape),   '') || '|' ||
         COALESCE(spec_sieve(sieve),   '') || '|' ||
         COALESCE(spec_mm(mm),         '') || '|' ||
         COALESCE(spec_colour(colour), '') || '|' ||
         COALESCE(spec_clarity(clarity), '');
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE lots ADD COLUMN unit_key text
  GENERATED ALWAYS AS (lot_unit_key(shape, sieve_size, mm_size, colour, clarity)) STORED;

CREATE UNIQUE INDEX lots_unit_uniq ON lots (unit_key) WHERE source = 'unit';

-- No re-merge needed: all 17 existing units carry colour = clarity = NULL, so
-- the extra key segments are blank on every row and none of them collide or
-- split under the new key.
