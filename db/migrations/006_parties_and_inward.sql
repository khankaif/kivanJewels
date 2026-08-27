-- Party master ------------------------------------------------------------
-- Terms are the supplier's credit days. In the source workbook
-- Due Date = Pur. Date + Terms held in 1938 of 1938 rows, 7 days standard,
-- so terms belong to the relationship, not to each transaction.
ALTER TABLE parties ADD COLUMN IF NOT EXISTS default_terms_days integer NOT NULL DEFAULT 7
  CHECK (default_terms_days >= 0 AND default_terms_days <= 365);
ALTER TABLE parties ADD COLUMN IF NOT EXISTS phone      text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS gstin      text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS notes      text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Memo header -------------------------------------------------------------
-- `agent` is the person who placed/handled the deal (source "Placed By":
-- Rushabh 1713, Dharmin 66, Sandeep 25...). It is staff/broker attribution,
-- deliberately NOT a party: the counterparty is party_id.
ALTER TABLE memos ADD COLUMN IF NOT EXISTS agent      text;
ALTER TABLE memos ADD COLUMN IF NOT EXISTS terms_days integer;
ALTER TABLE memos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Billings become direction-aware -----------------------------------------
-- An inward memo bills INTO a payable, an outward memo into a receivable.
-- rate is captured per billing because a vendor may invoice at a rate other
-- than the rate the goods were memo'd at.
ALTER TABLE memo_line_billings ADD COLUMN IF NOT EXISTS rate numeric(14,4);
ALTER TABLE memo_line_billings ADD COLUMN IF NOT EXISTS due_on date;

CREATE INDEX IF NOT EXISTS memos_direction_status_idx ON memos (direction, status);
CREATE INDEX IF NOT EXISTS memos_due_idx ON memos (due_on) WHERE status = 'open';

-- Outstanding per memo line, for BOTH directions.
-- Carats received/issued, less what has been returned and what has been billed.
CREATE OR REPLACE VIEW memo_line_status AS
SELECT
  ml.id            AS line_id,
  ml.memo_id,
  m.direction,
  m.memo_no,
  m.party_id,
  p.name           AS party_name,
  m.issued_on,
  m.due_on,
  m.agent,
  m.status         AS memo_status,
  ml.lot_id,
  l.lot_no,
  l.stone_type,
  l.shape,
  l.sieve_size,
  l.mm_size,
  ml.carats,
  ml.rate,
  ml.status        AS line_status,
  COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
            WHERE mv.memo_line_id = ml.id
              AND mv.kind IN ('memo_out_return','memo_in_return')), 0) AS returned,
  COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
            WHERE b.memo_line_id = ml.id), 0)                          AS billed,
  COALESCE((SELECT SUM(b.amount) FROM memo_line_billings b
            WHERE b.memo_line_id = ml.id), 0)                          AS billed_amount,
  ml.carats
    - COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
                WHERE mv.memo_line_id = ml.id
                  AND mv.kind IN ('memo_out_return','memo_in_return')), 0)
    - COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
                WHERE b.memo_line_id = ml.id), 0)                       AS outstanding
FROM memo_lines ml
JOIN memos   m ON m.id = ml.memo_id
JOIN parties p ON p.id = m.party_id
JOIN lots    l ON l.id = ml.lot_id;
