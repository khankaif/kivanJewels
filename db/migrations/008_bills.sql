-- Bill numbers were never imported. The source keeps them in two columns:
--   "Bill No." = OUR sale bill  (133 distinct, covering 1491 rows; one bill
--                carries up to 94 line items)
--   "Mode"     = the SUPPLIER's bill number (144 distinct, tied to Pur. Party)
-- Without them a bill is not addressable, which is the main thing the
-- spreadsheet did well: you can see the document, not just the transaction.
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS bill_no text;
CREATE INDEX IF NOT EXISTS ledger_bill_idx ON ledger (bill_no) WHERE bill_no IS NOT NULL;

-- A bill is a DOCUMENT: many lines, one number, one party, one date.
-- Rows whose bill number is "Cash"/"Bill"/blank are not documents; each falls
-- back to its own reference so nothing is silently merged into one bucket.
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
)
SELECT
  t.party_id,
  p.name                                                        AS party_name,
  t.direction,
  t.bill_key,
  MAX(t.bill_no) FILTER (WHERE lower(COALESCE(t.bill_no,'')) NOT IN ('','cash','bill'))
                                                                AS bill_no,
  bool_or(t.is_cash)                                            AS is_cash,
  MIN(t.dated_on) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice'))::text AS billed_on,
  MAX(t.dated_on) FILTER (WHERE t.kind IN ('payment_in','payment_out'))::text        AS last_paid_on,
  count(*) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice'))::int         AS lines,
  COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice'))),0) AS gross,
  COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.kind IN ('payment_in','payment_out'))),0)        AS paid,
  COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice'))),0)
    - COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.kind IN ('payment_in','payment_out'))),0)    AS balance,
  (CURRENT_DATE - MIN(t.dated_on) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice')))::int AS age_days
FROM tagged t
JOIN parties p ON p.id = t.party_id
GROUP BY t.party_id, p.name, t.direction, t.bill_key
HAVING count(*) FILTER (WHERE t.kind IN ('sale_invoice','purchase_invoice')) > 0;

-- Flat money register: every row, with the party resolved. The spreadsheet
-- equivalent of scrolling Diamond Hisab, but filterable in SQL.
CREATE OR REPLACE VIEW ledger_entries AS
SELECT
  g.id, g.dated_on::text AS dated_on, g.kind, g.amount, g.bill_no,
  g.ref_type, g.ref_id, g.notes,
  CASE WHEN g.kind IN ('sale_invoice','payment_in') THEN 'sale' ELSE 'purchase' END AS direction,
  g.party_id, p.name AS party_name
FROM ledger g JOIN parties p ON p.id = g.party_id;
