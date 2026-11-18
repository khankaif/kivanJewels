-- The grade master comes back as data the client's admin manages, and stock
-- points at it. Reverses 034's "grades are fixed lists in code": the client
-- defines their own values (the Diamond Work Flow sheet), and the master is
-- the base everything else stands on -- rename a value here and every lot,
-- sale line and catalog item that uses it shows the new name.
--
-- Why the drift 034 feared cannot come back:
--  * Stock stores a value the master holds, enforced by a foreign key, not a
--    string checked in app code. ON UPDATE CASCADE carries a rename into
--    every row; the default ON DELETE refuses removing a value in use, so a
--    value is retired (active = false) instead.
--  * Names are unique ignoring case and spaces: 'EF' and 'ef ' cannot both exist.
--
-- One table per list rather than one table of all lists: a foreign key into
-- `colours` cannot accept a clarity, and that is the guarantee being bought.
--
-- Values only: the fields themselves (type, colour, clarity...) stay in code.
-- Certification stays a fixed yes/no there too -- it is a rule, not a list.

-- ----------------------------------------------------------------- lists
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stone_types','colours','clarities','fluorescences','finish_grades','labs'] LOOP
    EXECUTE format($f$
      CREATE TABLE %1$I (
        name       text PRIMARY KEY CHECK (name ~ '^\S(.{0,38}\S)?$'),
        -- Short code from the work-flow sheet (LGD, FLY, VVS1). Optional:
        -- fluorescence has none. Also what a trader may type for the value.
        code       text CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{0,9}$'),
        sort_order int     NOT NULL DEFAULT 0,
        -- Retired values stay on old records but leave every picker.
        active     boolean NOT NULL DEFAULT true
      );
      CREATE UNIQUE INDEX %1$s_name_ci ON %1$I (lower(name));
      CREATE UNIQUE INDEX %1$s_code_uq ON %1$I (code) WHERE code IS NOT NULL;
    $f$, t);
  END LOOP;
END $$;

-- A colour is a single grade (E) or the range a parcel is graded as (EF).
-- Clarity likewise (VS1 / VS-SI). Both are real values: melee parcels are
-- bought and sold by range, and most of the book is EF VVS-VS.
INSERT INTO stone_types (name, code, sort_order) VALUES
  ('Natural','ND',1), ('Lab Grown','LGD',2), ('Cubic Zirconia','CZ',3),
  ('Colour Stone','CS',4), ('Pearl','P',5), ('Natural Polki','NP',6), ('Lab Grown Polki','LP',7);

INSERT INTO colours (name, code, sort_order)
SELECT c, c, i FROM unnest(string_to_array('D E F G H I J K L M N O P Q R S T U V W X Y Z', ' '))
  WITH ORDINALITY AS u(c, i);
INSERT INTO colours (name, code, sort_order) VALUES
  ('DE','DE',30), ('EF','EF',31), ('FG','FG',32), ('GH','GH',33), ('HI','HI',34),
  ('Fancy Light Yellow','FLY',50), ('Fancy Yellow','FY',51), ('Fancy Intense Yellow','FIY',52), ('Fancy Vivid Yellow','FVY',53),
  ('Fancy Light Pink','FLP',54),   ('Fancy Pink','FP',55),   ('Fancy Intense Pink','FIP',56),   ('Fancy Vivid Pink','FVP',57),
  ('Fancy Light Brown','FLB',58),  ('Fancy Brown','FB',59),  ('Fancy Intense Brown','FIB',60),  ('Fancy Vivid Brown','FVB',61);

-- The sheet's 'SI-GH' is left out: it is a clarity and a colour in one field.
INSERT INTO clarities (name, code, sort_order) VALUES
  ('FL','FL',1), ('IF','IF',2), ('VVS1','VVS1',3), ('VVS2','VVS2',4), ('VS1','VS1',5), ('VS2','VS2',6),
  ('SI1','SI1',7), ('SI2','SI2',8), ('I1','I1',9), ('I2','I2',10), ('I3','I3',11),
  ('VVS','VVS',20), ('VVS-VS','VVS-VS',21), ('VS','VS',22), ('VS-SI','VS-SI',23), ('SI','SI',24);

-- Best to weakest, as the sheet orders them.
INSERT INTO fluorescences (name, sort_order) VALUES
  ('None',1), ('Faint',2), ('Very Slight',3), ('Slight',4), ('Medium',5), ('Strong',6), ('Very Strong',7);

-- One scale for cut, polish and symmetry: the sheet repeats it three times,
-- and three copies are three lists that drift apart.
INSERT INTO finish_grades (name, code, sort_order) VALUES
  ('Ideal','ID',1), ('Excellent','EX',2), ('Very Good','VG',3), ('Good','GD',4), ('Fair','F',5), ('Poor','P',6);

-- 'Non-Certified' is not a lab: it is certified = no, a separate field.
INSERT INTO labs (name, code, sort_order) VALUES
  ('GIA','GIA',1), ('IGI','IGI',2), ('HRD','HRD',3), ('EGL','EGL',4), ('SGL','SGL',5),
  ('AGS','AGS',6), ('GCAL','GCAL',7), ('DGLA','DGLA',8);

-- Sub-types hang off their stone type (Lab Grown -> HPHT / CVD). Nothing in
-- stock records a sub-type yet; the list is here so the catalog can.
CREATE TABLE stone_subtypes (
  stone_type text NOT NULL REFERENCES stone_types(name) ON UPDATE CASCADE,
  name       text NOT NULL CHECK (name ~ '^\S(.{0,38}\S)?$'),
  code       text CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{0,9}$'),
  sort_order int     NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  PRIMARY KEY (stone_type, name)
);
CREATE UNIQUE INDEX stone_subtypes_name_ci ON stone_subtypes (stone_type, lower(name));
CREATE UNIQUE INDEX stone_subtypes_code_uq ON stone_subtypes (stone_type, code) WHERE code IS NOT NULL;
-- The sheet gives Precious GF and Synthetic the same code (SYCS); Precious GF
-- is left without one until the client says which it is.
INSERT INTO stone_subtypes (stone_type, name, code, sort_order) VALUES
  ('Lab Grown','HPHT','HPHT',1), ('Lab Grown','CVD','CVD',2),
  ('Colour Stone','Precious','PCS',1), ('Colour Stone','Precious Heated','SPHCS',2),
  ('Colour Stone','Precious GF',NULL,3), ('Colour Stone','Semi Precious','SPCS',4),
  ('Colour Stone','Synthetic','SYCS',5),
  ('Pearl','Cultured','CP',1), ('Pearl','Fresh Water','FP',2), ('Pearl','South Sea','SP',3);

-- Round is graded on cut, polish and symmetry; fancy shapes on polish and
-- symmetry only (the sheet's rule). A property of the shape, so it lives on it.
ALTER TABLE diamond_shapes
  ADD COLUMN has_cut boolean NOT NULL DEFAULT false,
  ADD COLUMN active  boolean NOT NULL DEFAULT true;
UPDATE diamond_shapes SET has_cut = true WHERE shape = 'Round';

-- --------------------------------------------- the book onto the master
-- 'Gemstone' was 034's name for what the sheet calls Colour Stone.
UPDATE lots              SET stone_type = 'Colour Stone' WHERE stone_type = 'Gemstone';
UPDATE requirement_lines SET stone_type = 'Colour Stone' WHERE stone_type = 'Gemstone';
UPDATE catalog_items     SET stone_type = 'Colour Stone' WHERE stone_type = 'Gemstone';

-- Every stored value must already be a master value, or the keys below fail
-- on a bare constraint name. Name the offenders instead.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT format('%s %s = %L', t, f, v), '; ') INTO bad FROM (
              SELECT 'lots' t, 'stone_type' f, stone_type v FROM lots WHERE stone_type NOT IN (SELECT name FROM stone_types)
    UNION ALL SELECT 'lots', 'colour', colour FROM lots WHERE colour NOT IN (SELECT name FROM colours)
    UNION ALL SELECT 'lots', 'clarity', clarity FROM lots WHERE clarity NOT IN (SELECT name FROM clarities)
    UNION ALL SELECT 'lots', 'lab', lab FROM lots WHERE lab NOT IN (SELECT name FROM labs)
    UNION ALL SELECT 'requirement_lines', 'stone_type', stone_type FROM requirement_lines WHERE stone_type NOT IN (SELECT name FROM stone_types)
    UNION ALL SELECT 'requirement_lines', 'colour', colour FROM requirement_lines WHERE colour NOT IN (SELECT name FROM colours)
    UNION ALL SELECT 'requirement_lines', 'clarity', clarity FROM requirement_lines WHERE clarity NOT IN (SELECT name FROM clarities)
    UNION ALL SELECT 'requirement_lines', 'lab', lab FROM requirement_lines WHERE lab NOT IN (SELECT name FROM labs)
    UNION ALL SELECT 'catalog_items', 'stone_type', stone_type FROM catalog_items WHERE stone_type NOT IN (SELECT name FROM stone_types)
  ) x;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Values not in the grade master: %. Add them to the master in this migration, or fix the rows.', bad;
  END IF;
END $$;

ALTER TABLE lots
  ADD FOREIGN KEY (stone_type) REFERENCES stone_types(name) ON UPDATE CASCADE,
  ADD FOREIGN KEY (colour)     REFERENCES colours(name)     ON UPDATE CASCADE,
  ADD FOREIGN KEY (clarity)    REFERENCES clarities(name)   ON UPDATE CASCADE,
  ADD FOREIGN KEY (lab)        REFERENCES labs(name)        ON UPDATE CASCADE;
ALTER TABLE requirement_lines
  ADD FOREIGN KEY (stone_type) REFERENCES stone_types(name) ON UPDATE CASCADE,
  ADD FOREIGN KEY (colour)     REFERENCES colours(name)     ON UPDATE CASCADE,
  ADD FOREIGN KEY (clarity)    REFERENCES clarities(name)   ON UPDATE CASCADE,
  ADD FOREIGN KEY (lab)        REFERENCES labs(name)        ON UPDATE CASCADE;
ALTER TABLE catalog_items
  ADD FOREIGN KEY (stone_type) REFERENCES stone_types(name) ON UPDATE CASCADE;
