-- spec_field_rules was a 6-shape x 5-field grid with three modes and an
-- inherit row, built to express one fact: a sieve size is a Round measurement.
-- Everything else it could say ("clarity is hidden for Pear") is not a thing
-- anyone needs to say. One flag on the shape replaces the whole table.
ALTER TABLE diamond_attributes ADD COLUMN IF NOT EXISTS uses_sieve boolean NOT NULL DEFAULT false;

UPDATE diamond_attributes SET uses_sieve = true
 WHERE attribute_type = 'shape' AND lower(value) LIKE '%round%';

DROP TABLE IF EXISTS spec_field_rules;
