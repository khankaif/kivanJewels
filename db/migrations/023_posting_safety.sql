-- Posting safety: all stock-changing paths eventually insert a `movements`
-- row, so serialising writes per lot here protects every UI and future API.
--
-- Without the row lock two concurrent transactions can each read the same
-- balance before either inserts, allowing a combined sale larger than stock.
-- The lock is intentionally on `lots`, not an aggregate query: Postgres can
-- lock a stable row while we calculate the ledger balance beneath it.
CREATE OR REPLACE FUNCTION check_lot_not_overdrawn() RETURNS trigger AS $$
DECLARE
  bal numeric(10,3);
BEGIN
  IF NEW.carats < 0 THEN
    PERFORM 1 FROM lots WHERE id = NEW.lot_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lot % does not exist', NEW.lot_id USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT COALESCE(SUM(carats), 0) INTO bal FROM movements WHERE lot_id = NEW.lot_id;
    IF bal + NEW.carats < -0.0005 THEN
      RAISE EXCEPTION 'insufficient stock in lot %: balance %, requested %',
        NEW.lot_id, bal, ABS(NEW.carats)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The financial ledger is source-of-truth data just like movements. Corrections
-- must be posted as an explicit reversing entry; silent edits destroy a
-- statement's audit trail.
CREATE OR REPLACE FUNCTION ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only; post a reversing or adjustment row instead'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_no_mutate ON ledger;
CREATE TRIGGER ledger_no_mutate
  BEFORE UPDATE OR DELETE ON ledger
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();
