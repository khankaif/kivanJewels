-- 023 made lab and certification part of stock identity, but lot_balances --
-- what every stock list actually reads -- still only carried the five older
-- spec columns. New columns go on the end: CREATE OR REPLACE VIEW cannot
-- reorder or rename the existing ones.
CREATE OR REPLACE VIEW lot_balances AS
SELECT
  l.id                        AS lot_id,
  l.lot_no,
  l.stone_type, l.shape, l.sieve_size, l.mm_size, l.clarity, l.colour,
  l.cost_rate,
  l.source,
  p.name                      AS party_name,
  COALESCE(SUM(m.carats), 0)  AS balance,
  COALESCE((
    SELECT SUM(ml.carats
               - COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
                           WHERE mv.memo_line_id = ml.id AND mv.kind = 'memo_out_return'), 0)
               - COALESCE((SELECT SUM(b.carats) FROM memo_line_billings b
                           WHERE b.memo_line_id = ml.id), 0))
    FROM memo_lines ml
    JOIN memos mo ON mo.id = ml.memo_id
    WHERE ml.lot_id = l.id AND ml.status = 'open' AND mo.direction = 'out'
  ), 0)                       AS exposure,
  l.lab,
  l.certified,
  l.unit_key
FROM lots l
LEFT JOIN parties p ON p.id = l.party_id
LEFT JOIN movements m ON m.lot_id = l.id
GROUP BY l.id, p.name;
