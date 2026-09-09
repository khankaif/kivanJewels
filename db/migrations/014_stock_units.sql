-- Purchase stock is fungible by spec. Two parcels of Round / 8.5-9 / 2.20mm are
-- one thing to sell from, not two rows to reconcile. Memo stock is NOT fungible:
-- that parcel goes back to that supplier, so it keeps its own lot.
--
-- Identity is the spec, normalized. The source spells the same stone three ways
-- ('2.20 MM', '2.20mm', '2.2') and calls a round brilliant both 'Round' and
-- 'RBC'; without normalizing, "one unit" would still be four rows.

-- '2.20' -> '2.2', '2.00' -> '2'. Non-numeric junk (cert numbers landed in
-- sieve_size on 200-odd imported rows) passes through untouched.
CREATE OR REPLACE FUNCTION spec_num(t text) RETURNS text AS $$
  SELECT CASE WHEN t ~ '^[0-9]+(\.[0-9]+)?$' THEN trim_scale(t::numeric)::text ELSE t END;
$$ LANGUAGE sql IMMUTABLE STRICT;

-- '5.00 X 2.50' and '5.00*2.50mm' are the same fancy: '5x2.5'.
CREATE OR REPLACE FUNCTION spec_mm(t text) RETURNS text AS $$
  SELECT string_agg(spec_num(p), 'x')
  FROM unnest(string_to_array(
    regexp_replace(
      translate(regexp_replace(lower(btrim(t)), '\s+', '', 'g'), '*×', 'xx'),
      'mm$', ''),
    'x')) AS p;
$$ LANGUAGE sql IMMUTABLE STRICT;

-- '+7.5-8' and '7.5-8' are one grade: plus-notation names the same range.
-- Numbers are NOT trimmed here -- '00-0' and '000-00' are different grades and
-- trim_scale would collapse both to '0-0'.
CREATE OR REPLACE FUNCTION spec_sieve(t text) RETURNS text AS $$
  SELECT ltrim(regexp_replace(lower(btrim(t)), '\s+', '', 'g'), '+');
$$ LANGUAGE sql IMMUTABLE STRICT;

-- Only the abbreviations actually present in the data are folded. 'Round-Single
-- Cut' and 'Pi-Cut Round' are different cuts and stay different units.
CREATE OR REPLACE FUNCTION spec_shape(t text) RETURNS text AS $$
  SELECT CASE s
           WHEN 'rbc'        THEN 'round'
           WHEN 'mq'         THEN 'marquise'
           WHEN 'trapezoids' THEN 'trapezoid'
           ELSE s
         END
  FROM (SELECT regexp_replace(lower(btrim(t)), '\s+', ' ', 'g')) AS x(s);
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION lot_unit_key(shape text, sieve text, mm text) RETURNS text AS $$
  SELECT COALESCE(spec_shape(shape), '') || '|' ||
         COALESCE(spec_sieve(sieve), '') || '|' ||
         COALESCE(spec_mm(mm),    '');
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE lots ADD COLUMN IF NOT EXISTS unit_key text
  GENERATED ALWAYS AS (lot_unit_key(shape, sieve_size, mm_size)) STORED;

-- 'unit' is owned stock, consolidated by spec. The older values survive on the
-- 1977 depleted lots the import left behind, which are history, not stock.
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_source_check;
ALTER TABLE lots ADD CONSTRAINT lots_source_check
  CHECK (source IN ('purchase','memo_in','opening','legacy_selflot','unit'));

-- The guard that makes consolidation true rather than merely intended.
CREATE UNIQUE INDEX IF NOT EXISTS lots_unit_uniq ON lots (unit_key) WHERE source = 'unit';

CREATE SEQUENCE IF NOT EXISTS lot_unit_seq;

-- One-off merge of the live lots ------------------------------------------
-- 19 lots carry a balance and four of them are duplicate specs bought at
-- different rates (8.5-9/2.20mm twice, 9-9.5/2.30mm twice). Snapshot first:
-- lot_balances is computed from movements, and this block writes movements.
CREATE TEMP TABLE _merge ON COMMIT DROP AS
SELECT l.unit_key, b.lot_id, l.lot_no, b.balance::numeric AS balance,
       COALESCE(l.cost_rate, 0) AS cost_rate
FROM lot_balances b JOIN lots l ON l.id = b.lot_id
WHERE b.balance > 0.0005 AND l.source <> 'memo_in';

DO $$
DECLARE g record; o record;
BEGIN
  FOR g IN
    SELECT unit_key,
           (array_agg(lot_id ORDER BY balance DESC, lot_id))[1] AS keep_id,
           SUM(balance * cost_rate) / SUM(balance)              AS rate
    FROM _merge GROUP BY unit_key
  LOOP
    FOR o IN SELECT * FROM _merge WHERE unit_key = g.unit_key AND lot_id <> g.keep_id
    LOOP
      -- movements is append-only, so a merge is posted, never rewritten.
      INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on, notes)
      VALUES (o.lot_id, 'adjust_out', -o.balance, o.cost_rate,
              round(o.balance * o.cost_rate, 2), CURRENT_DATE,
              'merged into unit ' || g.unit_key);
      INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on, notes)
      VALUES (g.keep_id, 'adjust_in', o.balance, o.cost_rate,
              round(o.balance * o.cost_rate, 2), CURRENT_DATE,
              'merged from lot ' || o.lot_no);
    END LOOP;
    -- Weighted average over the whole group: cost is value / weight.
    UPDATE lots SET source = 'unit', cost_rate = g.rate WHERE id = g.keep_id;
  END LOOP;
END $$;
