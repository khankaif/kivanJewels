-- Postgres `date` arrives in JS as a Date at LOCAL midnight. In IST (+5:30)
-- `.toISOString().slice(0,10)` then reports the previous day. Casting to text
-- in the read model removes the timezone from the path entirely: a calendar
-- date has no time zone, and should never travel as one.
DROP VIEW IF EXISTS memo_line_status;
CREATE VIEW memo_line_status AS
SELECT
  ml.id            AS line_id,
  ml.memo_id,
  m.direction,
  m.memo_no,
  m.party_id,
  p.name           AS party_name,
  m.issued_on::text AS issued_on,
  m.due_on::text    AS due_on,
  (m.status = 'open' AND m.due_on IS NOT NULL AND m.due_on < CURRENT_DATE) AS overdue,
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
