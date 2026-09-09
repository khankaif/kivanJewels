-- Party master: KYC fields the sheet never had a column for.
ALTER TABLE parties ADD COLUMN IF NOT EXISTS business_name   text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS contact_person  text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS address         text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS pan             text;

-- Diamond master: controlled values for the attributes that are typed free
-- text today and drift as a result (colour holds both 'EF' and 'F.V.Pink',
-- clarity holds both 'VS1' and 'vs2/vs1'). Sieve and mm are deliberately NOT
-- here -- 507 and 427 distinct values respectively is not a picklist, it's a
-- measurement, and lot_unit_key() already normalizes it on write.
CREATE TABLE diamond_attributes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_type text NOT NULL CHECK (attribute_type IN ('colour','clarity','shape','lab')),
  value          text NOT NULL,
  sort_order     int  NOT NULL DEFAULT 0,
  UNIQUE (attribute_type, value)
);

-- Seeded clean, not from the existing data: the existing colour/clarity
-- columns are exactly the mess this table exists to stop. Values below are
-- the standard grades plus the blended ranges this business actually quotes
-- in bulk (EF and VVS-VS alone cover most of the 1996 imported lots).
INSERT INTO diamond_attributes (attribute_type, value, sort_order) VALUES
  ('colour','D',1),('colour','E',2),('colour','F',3),('colour','G',4),
  ('colour','H',5),('colour','I',6),('colour','J',7),
  ('colour','DE',10),('colour','EF',11),('colour','FG',12),('colour','GH',13),('colour','HI',14),
  ('clarity','FL',1),('clarity','IF',2),('clarity','VVS1',3),('clarity','VVS2',4),
  ('clarity','VS1',5),('clarity','VS2',6),('clarity','SI1',7),('clarity','SI2',8),('clarity','I1',9),
  ('clarity','VVS',20),('clarity','VVS-VS',21),('clarity','VS',22),('clarity','VS-SI',23),('clarity','SI',24),
  ('shape','Round',1),('shape','Oval',2),('shape','Pear',3),('shape','Marquise',4),
  ('shape','Emerald',5),('shape','Princess',6),('shape','Cushion',7),('shape','Radiant',8),
  ('shape','Heart',9),('shape','Asscher',10),('shape','Baguette',11),('shape','Trapezoid',12),
  ('shape','Half Moon',13),
  ('lab','IGI',1),('lab','HRD',2),('lab','GIA',3)
ON CONFLICT DO NOTHING;
