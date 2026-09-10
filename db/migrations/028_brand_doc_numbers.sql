-- The house issues these documents, so they carry the house's initials.
UPDATE doc_series SET format = 'KJ-OUT-{YYYY}-{0000}' WHERE kind = 'memo_out';
UPDATE doc_series SET format = 'KJ-IN-{YYYY}-{0000}'  WHERE kind = 'memo_in';
UPDATE doc_series SET format = 'KJ-INV-{YYYY}-{0000}' WHERE kind = 'invoice';

-- Requirements are internal, but they get read out on the phone often enough
-- to be worth naming too.
ALTER TABLE requirements ALTER COLUMN requirement_no
  SET DEFAULT ('KJ-REQ-' || nextval('requirement_seq'));
