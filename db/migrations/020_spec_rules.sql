-- Masters, part two: the picklists become admin-extensible, and the forms stop
-- hardcoding which spec fields apply.
--
-- The concrete complaint: a sieve size is a Round-only measurement, but every
-- form offered it for Oval and Baguette too. That rule lived nowhere, so it
-- could only be enforced by a code change. It lives here now.

-- Buckets: 'shape'/'colour'/'clarity'/'lab' were a CHECK constraint, so adding
-- a list meant a migration. Now they are rows.
CREATE TABLE IF NOT EXISTS attribute_buckets (
  key        text PRIMARY KEY,
  label      text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  -- Preset buckets are wired to a spec column; they can gain and lose values
  -- but cannot be deleted, or the forms lose a field they reference by name.
  is_preset  boolean NOT NULL DEFAULT false
);

INSERT INTO attribute_buckets (key, label, sort_order, is_preset) VALUES
  ('shape','Shape',1,true), ('colour','Colour',2,true),
  ('clarity','Clarity',3,true), ('lab','Certification lab',4,true),
  ('stone_type','Stone type',5,true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE diamond_attributes DROP CONSTRAINT IF EXISTS diamond_attributes_attribute_type_check;
ALTER TABLE diamond_attributes
  ADD CONSTRAINT diamond_attributes_bucket_fk
  FOREIGN KEY (attribute_type) REFERENCES attribute_buckets(key) ON UPDATE CASCADE;

-- Stone type was free text defaulting to 'Lab Grown' on five forms.
INSERT INTO diamond_attributes (attribute_type, value, sort_order)
  SELECT 'stone_type', v, i
  FROM (VALUES ('Lab Grown',1),('Natural',2)) AS t(v,i)
ON CONFLICT DO NOTHING;

-- Which spec fields a given shape actually uses. shape_value '*' is the
-- default every shape inherits; a row for a named shape overrides it.
CREATE TABLE IF NOT EXISTS spec_field_rules (
  shape_value text NOT NULL,
  field       text NOT NULL CHECK (field IN
                ('stoneType','shape','sieveSize','mmSize','colour','clarity')),
  mode        text NOT NULL CHECK (mode IN ('required','optional','hidden')),
  PRIMARY KEY (shape_value, field)
);

INSERT INTO spec_field_rules (shape_value, field, mode) VALUES
  -- Default: no shape named yet, so offer both sizes and demand neither here
  -- (validateSpec still requires one of them; see lib/spec-rules.ts).
  ('*','stoneType','required'), ('*','shape','required'),
  ('*','sieveSize','optional'), ('*','mmSize','optional'),
  ('*','colour','optional'),    ('*','clarity','optional'),
  -- Round is sieved. Everything else is measured in mm.
  ('Round','sieveSize','required'), ('Round','mmSize','optional')
ON CONFLICT DO NOTHING;

INSERT INTO spec_field_rules (shape_value, field, mode)
  SELECT value, 'sieveSize', 'hidden' FROM diamond_attributes
   WHERE attribute_type = 'shape' AND value <> 'Round'
ON CONFLICT DO NOTHING;

INSERT INTO spec_field_rules (shape_value, field, mode)
  SELECT value, 'mmSize', 'required' FROM diamond_attributes
   WHERE attribute_type = 'shape' AND value <> 'Round'
ON CONFLICT DO NOTHING;
