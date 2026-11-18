-- The size chart becomes the client's Measurement & Weight Chart: a size is a
-- shape, its face-up length x width in mm (a tapered baguette also has its
-- narrow end), and the carats a stone of that size weighs. Replaces 034's
-- carat bands estimated from a 1 ct anchor: the client measures, so nothing is
-- estimated, and sieve sizes are gone.
--
-- Carat is no longer the identity. Their chart has one mm with two weights
-- (square cushion 5.3 x 5.3 = 0.75 and 0.80 ct: same face-up, different
-- depth), so a size is (shape, mm, carats) and the operator picks it -- a
-- stone's weight alone does not say which size it is.
--
-- Shapes become the work-flow sheet's list, each with its code (RBC, PS, CMB),
-- which also prefixes its Size IDs.
--
-- Runs on an empty book only: lots point at sizes, and old carat bands do not
-- map onto measured sizes. Wipe stock and sales first.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM lots) OR EXISTS (SELECT 1 FROM requirement_lines) THEN
    RAISE EXCEPTION 'Migration 036 replaces the size chart and needs an empty book: wipe stock and sales first.';
  END IF;
END $$;

-- CASCADE drops only the lots' and sale lines' foreign keys into it (both
-- tables are empty); they are re-added below.
DROP TABLE diamond_sizes CASCADE;

-- ------------------------------------------------------------------ shapes
DELETE FROM diamond_shapes;
ALTER TABLE diamond_shapes
  DROP COLUMN length_mm, DROP COLUMN width_mm;
ALTER TABLE diamond_shapes RENAME COLUMN prefix TO code;
ALTER TABLE diamond_shapes DROP CONSTRAINT IF EXISTS diamond_shapes_prefix_check;
ALTER TABLE diamond_shapes ADD CONSTRAINT diamond_shapes_code_check CHECK (code ~ '^[A-Z]{2,4}$');
CREATE UNIQUE INDEX diamond_shapes_name_ci ON diamond_shapes (lower(shape));

-- Round alone is graded on cut (the sheet's rule). The radiant and cushion
-- families each split by outline, as the sheet's shape list already does.
INSERT INTO diamond_shapes (shape, code, has_cut, sort_order) VALUES
  ('Round','RBC',true,1), ('Pear','PS',false,2), ('Emerald','EM',false,3), ('Princess','PRN',false,4),
  ('Marquise','MQ',false,5), ('Asscher','AC',false,6), ('Baguette','BAG',false,7),
  ('Tapered Baguette','TBAG',false,8), ('Long Cushion','CB',false,9), ('Square Cushion','CMB',false,10),
  ('Half Moon','HM',false,11), ('Heart','HT',false,12), ('Kite','KT',false,13), ('Lozenge','LOZ',false,14),
  ('Old Miner','OM',false,15), ('Oval','OV',false,16), ('Radiant','RAD',false,17),
  ('Square Radiant','SQR',false,18), ('Trapezoid','TP',false,19), ('Triangle','TRI',false,20),
  ('Trilliant','TRIL',false,21);

-- ------------------------------------------------------------------- sizes
CREATE TABLE diamond_sizes (
  -- The Size ID (PS-4X2.5): what pickers show and traders type. Made from
  -- the shape code and mm when a size is added; editable, and a change
  -- follows into every lot through ON UPDATE CASCADE.
  id         text PRIMARY KEY CHECK (id ~ '^[A-Z0-9][A-Z0-9.X-]{0,23}$'),
  shape      text NOT NULL REFERENCES diamond_shapes(shape) ON UPDATE CASCADE,
  -- Face-up mm. For a tapered baguette, width = the wide end, width2 = the narrow.
  length_mm  numeric(5,2) NOT NULL CHECK (length_mm > 0),
  width_mm   numeric(5,2) NOT NULL CHECK (width_mm > 0),
  width2_mm  numeric(5,2) CHECK (width2_mm > 0),
  -- Carats PER STONE. One weight, or the range a melee size spans
  -- (round 1.5 mm = 0.014-0.015 ct): equal when it is one weight.
  min_ct     numeric(7,4) NOT NULL CHECK (min_ct > 0),
  max_ct     numeric(7,4) NOT NULL CHECK (max_ct <= 100),
  ratio      numeric(5,2) GENERATED ALWAYS AS (round(length_mm / width_mm, 2)) STORED,
  active     boolean NOT NULL DEFAULT true,
  CHECK (max_ct >= min_ct),
  -- The same size twice is a typo. NULLS NOT DISTINCT: two rows without a
  -- narrow end are still the same row.
  UNIQUE NULLS NOT DISTINCT (shape, length_mm, width_mm, width2_mm, min_ct, max_ct),
  -- Target of the lots' (size_id, shape) foreign key: a lot's shape is its size's.
  UNIQUE (id, shape)
);

ALTER TABLE lots
  ADD FOREIGN KEY (size_id, shape) REFERENCES diamond_sizes(id, shape) ON UPDATE CASCADE;
ALTER TABLE requirement_lines
  ADD FOREIGN KEY (size_id, shape) REFERENCES diamond_sizes(id, shape) ON UPDATE CASCADE;

-- What Masters -> Sizes -> Export hands to a spreadsheet, in the columns the
-- import reads back. Carats as one figure or "min-max".
CREATE VIEW size_chart AS
SELECT s.id AS size_id, s.shape, s.length_mm, s.width_mm, s.width2_mm,
       CASE WHEN s.min_ct = s.max_ct THEN trim_scale(s.min_ct)::text
            ELSE trim_scale(s.min_ct) || '-' || trim_scale(s.max_ct) END AS carats,
       CASE WHEN s.active THEN 'yes' ELSE 'no' END AS active
FROM diamond_sizes s JOIN diamond_shapes d ON d.shape = s.shape
ORDER BY d.sort_order, s.min_ct, s.length_mm;
