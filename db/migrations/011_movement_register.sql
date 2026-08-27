-- Carat-level register: the movement ledger with its lot, party and memo
-- resolved, plus a per-lot running balance so a lot's history reads like a
-- passbook. Dates as text: a calendar date carries no time zone.
CREATE OR REPLACE VIEW movement_entries AS
SELECT
  m.id,
  m.moved_on::text                     AS moved_on,
  m.kind,
  m.carats,
  m.rate,
  m.amount,
  m.notes,
  m.ref_type,
  m.ref_id,
  l.id                                 AS lot_id,
  l.lot_no,
  l.stone_type,
  l.shape,
  l.sieve_size,
  l.mm_size,
  l.source                             AS lot_source,
  p.id                                 AS party_id,
  p.name                               AS party_name,
  mo.memo_no,
  mo.direction                         AS memo_direction,
  (m.carats > 0)                       AS is_inward,
  SUM(m.carats) OVER (PARTITION BY m.lot_id
                      ORDER BY m.moved_on, m.created_at, m.id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM movements m
JOIN lots l          ON l.id = m.lot_id
LEFT JOIN parties p  ON p.id = l.party_id
LEFT JOIN memo_lines ml ON ml.id = m.memo_line_id
LEFT JOIN memos mo   ON mo.id = ml.memo_id;
