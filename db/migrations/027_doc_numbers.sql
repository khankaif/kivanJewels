-- Document numbers the app issues for itself.
--
-- Only OUR documents are numbered here. A supplier's bill number is theirs and
-- is still typed in as it appears on their paper; and in Receive stock a blank
-- bill number still means a cash purchase with no payable, so nothing is
-- auto-filled there.
CREATE TABLE IF NOT EXISTS doc_series (
  kind    text PRIMARY KEY,
  -- {YYYY} is the calendar year, {0000} the running number padded to that width.
  format  text NOT NULL,
  next_no integer NOT NULL DEFAULT 1 CHECK (next_no > 0)
);

INSERT INTO doc_series (kind, format) VALUES
  ('memo_out', 'JGD-OUT-{YYYY}-{0000}'),
  ('memo_in',  'JGD-IN-{YYYY}-{0000}'),
  ('invoice',  'INV-{YYYY}-{0000}')
ON CONFLICT (kind) DO NOTHING;

-- Atomic: the UPDATE ... RETURNING takes the row lock, so two sales saved at
-- the same instant cannot be handed the same number.
CREATE OR REPLACE FUNCTION next_doc_no(series_kind text) RETURNS text AS $$
DECLARE
  fmt   text;
  n     integer;
  zeros text;
BEGIN
  UPDATE doc_series SET next_no = next_no + 1
   WHERE kind = series_kind
   RETURNING format, next_no - 1 INTO fmt, n;
  IF fmt IS NULL THEN
    RAISE EXCEPTION 'no document series called %', series_kind;
  END IF;

  zeros := (regexp_match(fmt, '\{(0+)\}'))[1];
  RETURN replace(
    replace(fmt, '{' || COALESCE(zeros, '0') || '}', lpad(n::text, COALESCE(length(zeros), 1), '0')),
    '{YYYY}', to_char(CURRENT_DATE, 'YYYY'));
END;
$$ LANGUAGE plpgsql;
