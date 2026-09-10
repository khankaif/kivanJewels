-- Columns no code path has ever written.
--
-- lots.notes:                  0 of 1996 rows. No INSERT anywhere names it.
-- memo_line_billings.due_on:   0 of 3 rows. billMemoLine accepts a dueOn nobody
--                              passes; a billing's due date belongs to the bill,
--                              which the ledger row already carries.
ALTER TABLE lots               DROP COLUMN IF EXISTS notes;
ALTER TABLE memo_line_billings DROP COLUMN IF EXISTS due_on;

-- A consolidated unit spans every supplier it was ever bought from, so the
-- party_id it inherited from whichever lot won the merge is not a fact about
-- the unit -- it is noise that reads like provenance. Supplier history lives in
-- the movements, and memo parcels (which DO belong to one supplier) keep theirs.
UPDATE lots SET party_id = NULL WHERE source = 'unit';
