-- How the money moved. The source "Mode" column was unusable for this: it holds
-- supplier bill numbers, not payment modes.
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS mode text
  CHECK (mode IS NULL OR mode IN ('bank','cash','upi','cheque','adjustment','other'));
CREATE INDEX IF NOT EXISTS ledger_payment_idx ON ledger (party_id, dated_on)
  WHERE kind IN ('payment_in','payment_out');
