CREATE OR REPLACE FUNCTION aging_as_of(as_of date)
RETURNS TABLE (
  party_id uuid, party_name text,
  d0_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, total numeric
) AS $$
  SELECT p.id, p.name,
    COALESCE(SUM(CASE WHEN as_of - g.dated_on BETWEEN 0  AND 30 THEN g.amount END), 0),
    COALESCE(SUM(CASE WHEN as_of - g.dated_on BETWEEN 31 AND 60 THEN g.amount END), 0),
    COALESCE(SUM(CASE WHEN as_of - g.dated_on BETWEEN 61 AND 90 THEN g.amount END), 0),
    COALESCE(SUM(CASE WHEN as_of - g.dated_on > 90              THEN g.amount END), 0),
    COALESCE(SUM(g.amount), 0)
  FROM parties p
  JOIN ledger g ON g.party_id = p.id AND g.kind = 'sale_invoice' AND g.dated_on <= as_of
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(g.amount), 0) <> 0;
$$ LANGUAGE sql STABLE;
