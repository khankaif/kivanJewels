-- The overdraw guard lives in the database, not in application code, so that a
-- future API route or a manual psql session cannot bypass it.
CREATE OR REPLACE FUNCTION check_lot_not_overdrawn() RETURNS trigger AS $$
DECLARE
  bal numeric(10,3);
BEGIN
  IF NEW.carats < 0 THEN
    SELECT COALESCE(SUM(carats), 0) INTO bal FROM movements WHERE lot_id = NEW.lot_id;
    -- Tolerance matches the numeric(10,3) scale: permits exact depletion to
    -- zero without letting a real overdraw through.
    IF bal + NEW.carats < -0.0005 THEN
      RAISE EXCEPTION 'insufficient stock in lot %: balance %, requested %',
        NEW.lot_id, bal, ABS(NEW.carats)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER movements_overdraw_guard
  BEFORE INSERT ON movements
  FOR EACH ROW EXECUTE FUNCTION check_lot_not_overdrawn();

CREATE OR REPLACE FUNCTION movements_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'movements is append-only; post a reversing row instead'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER movements_no_mutate
  BEFORE UPDATE OR DELETE ON movements
  FOR EACH ROW EXECUTE FUNCTION movements_append_only();
