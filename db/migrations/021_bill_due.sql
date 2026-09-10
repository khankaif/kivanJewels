-- A bill you cannot chase is half a bill. `bills` could tell you the balance
-- and the age, but not whether the money was actually late: terms lived on the
-- party (default_terms_days) and were never written down per document.

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS due_on date;
CREATE INDEX IF NOT EXISTS ledger_due_idx ON ledger (due_on)
  WHERE kind IN ('sale_invoice','purchase_invoice');

-- Backfill: an existing bill's due date is its date plus the party's terms.
UPDATE ledger g
   SET due_on = g.dated_on + (p.default_terms_days || ' days')::interval
  FROM parties p
 WHERE p.id = g.party_id
   AND g.due_on IS NULL
   AND g.kind IN ('sale_invoice','purchase_invoice');

CREATE OR REPLACE VIEW bills AS
WITH tagged AS (
  SELECT
    g.*,
    CASE WHEN g.kind IN ('sale_invoice','payment_in') THEN 'sale' ELSE 'purchase' END AS direction,
    CASE
      WHEN g.bill_no IS NULL OR g.bill_no = '' OR lower(g.bill_no) IN ('cash','bill')
        THEN COALESCE(g.ref_type,'') || ':' || COALESCE(g.ref_id, g.id::text)
      ELSE g.bill_no
    END AS bill_key,
    (g.bill_no IS NOT NULL AND lower(g.bill_no) = 'cash') AS is_cash
  FROM ledger g
  WHERE g.kind IN ('sale_invoice','purchase_invoice','payment_in','payment_out')
),
grouped AS (
  SELECT
    t.party_id,
    p.name                                                        AS party_name,
    t.direction,
    t.bill_key,
    MAX(t.bill_no) FILTER (WHERE lower(COALESCE(t.bill_no,'')) NOT IN ('','cash','bill'))
                                                                  AS bill_no,
    bool_or(t.is_cash)                                            AS is_cash,
    MIN(t.dated_on) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice')) AS billed_on,
    MAX(t.dated_on) FILTER (WHERE t.kind IN ('payment_in','payment_out'))        AS last_paid_on,
    MAX(t.due_on)   FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice')) AS due_on,
    count(*) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice'))::int   AS lines,
    COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice'))),0) AS gross,
    COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.kind IN ('payment_in','payment_out'))),0)        AS paid
  FROM tagged t
  JOIN parties p ON p.id = t.party_id
  GROUP BY t.party_id, p.name, t.direction, t.bill_key
  HAVING count(*) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice')) > 0
)
SELECT
  g.party_id, g.party_name, g.direction, g.bill_key, g.bill_no, g.is_cash,
  g.billed_on::text                     AS billed_on,
  g.last_paid_on::text                  AS last_paid_on,
  g.lines, g.gross, g.paid,
  g.gross - g.paid                      AS balance,
  (CURRENT_DATE - g.billed_on)::int     AS age_days,
  -- New columns go on the end: CREATE OR REPLACE VIEW cannot reorder existing
  -- ones, and every reader here selects by name anyway.
  g.due_on::text                        AS due_on,
  -- Days past due; negative while it is still within terms.
  CASE WHEN g.due_on IS NULL THEN NULL ELSE (CURRENT_DATE - g.due_on)::int END AS days_overdue,
  -- Status is derived, never typed: the payments are already in the ledger.
  CASE
    WHEN g.gross - g.paid <= 0.005 THEN 'paid'
    WHEN g.due_on IS NOT NULL AND g.due_on < CURRENT_DATE THEN 'overdue'
    WHEN g.paid > 0.005 THEN 'part'
    ELSE 'due'
  END AS status
FROM grouped g;
