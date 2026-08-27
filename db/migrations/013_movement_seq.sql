-- created_at defaults to now(), which in Postgres is the TRANSACTION timestamp:
-- every row written by the bulk import shares one value, so it cannot order a
-- lot's history. Ties then fell to a random uuid and the passbook read as
-- "sold, then purchased" on the same day.
--
-- Order within a day by direction instead: goods must arrive before they leave.
-- Deterministic, and it matches how a stock book is actually read.
DROP VIEW IF EXISTS movement_entries;
CREATE VIEW movement_entries AS
SELECT
  m.id,
  m.moved_on::text                     AS moved_on,
  m.created_at,
  (m.carats < 0)                       AS is_outward,
  m.kind, m.carats, m.rate, m.amount, m.notes, m.ref_type, m.ref_id,
  l.id AS lot_id, l.lot_no, l.stone_type, l.shape, l.sieve_size, l.mm_size,
  l.source AS lot_source,
  p.id AS party_id, p.name AS party_name,
  mo.memo_no, mo.direction AS memo_direction,
  (m.carats > 0)                       AS is_inward,
  SUM(m.carats) OVER (PARTITION BY m.lot_id
                      ORDER BY m.moved_on, (m.carats < 0), m.id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM movements m
JOIN lots l          ON l.id = m.lot_id
LEFT JOIN parties p  ON p.id = l.party_id
LEFT JOIN memo_lines ml ON ml.id = m.memo_line_id
LEFT JOIN memos mo   ON mo.id = ml.memo_id;
