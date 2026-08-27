-- balance = carats physically in the vault.
-- exposure = carats sitting with a client on an open outward memo line.
CREATE VIEW lot_balances AS
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
  ), 0)                       AS exposure
FROM lots l
LEFT JOIN parties p ON p.id = l.party_id
LEFT JOIN movements m ON m.lot_id = l.id
GROUP BY l.id, p.name;

CREATE VIEW party_balances AS
SELECT
  p.id   AS party_id,
  p.name AS party_name,
  -- Classify by KIND, not by sign: payment_out is positive but is not a
  -- receivable, and payment_in is negative but is not a payable. A party that
  -- is both supplier and client would otherwise show inflated figures on both.
  COALESCE(SUM(g.amount) FILTER (WHERE g.kind IN ('sale_invoice','payment_in')), 0)       AS receivable,
  COALESCE(-SUM(g.amount) FILTER (WHERE g.kind IN ('purchase_invoice','payment_out')), 0) AS payable,
  COALESCE(SUM(g.amount), 0)                                                              AS net
FROM parties p
LEFT JOIN ledger g ON g.party_id = p.id
GROUP BY p.id, p.name;
