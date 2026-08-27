-- Aging must report what is UNPAID, not what was invoiced.
--
-- The import links each payment to the same (ref_type, ref_id) as its invoice,
-- so a per-reference net is exact rather than an oldest-first guess. Rows are
-- bucketed by the INVOICE date and only surface while the reference still owes.
CREATE OR REPLACE FUNCTION aging_as_of(as_of date)
RETURNS TABLE (
  party_id uuid, party_name text,
  d0_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, total numeric
) AS $$
  WITH per_ref AS (
    SELECT g.party_id,
           COALESCE(g.ref_type, '') AS ref_type,
           COALESCE(g.ref_id, g.id::text) AS ref_id,
           MIN(g.dated_on) FILTER (WHERE g.kind = 'sale_invoice') AS invoiced_on,
           SUM(g.amount) AS outstanding
    FROM ledger g
    WHERE g.kind IN ('sale_invoice','payment_in') AND g.dated_on <= as_of
    GROUP BY g.party_id, COALESCE(g.ref_type,''), COALESCE(g.ref_id, g.id::text)
    HAVING SUM(g.amount) > 0.005
       AND MIN(g.dated_on) FILTER (WHERE g.kind = 'sale_invoice') IS NOT NULL
  )
  SELECT p.id, p.name,
    COALESCE(SUM(r.outstanding) FILTER (WHERE as_of - r.invoiced_on BETWEEN 0  AND 30), 0),
    COALESCE(SUM(r.outstanding) FILTER (WHERE as_of - r.invoiced_on BETWEEN 31 AND 60), 0),
    COALESCE(SUM(r.outstanding) FILTER (WHERE as_of - r.invoiced_on BETWEEN 61 AND 90), 0),
    COALESCE(SUM(r.outstanding) FILTER (WHERE as_of - r.invoiced_on > 90), 0),
    COALESCE(SUM(r.outstanding), 0)
  FROM parties p
  JOIN per_ref r ON r.party_id = p.id
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(r.outstanding), 0) > 0.005;
$$ LANGUAGE sql STABLE;

-- Jewellery orders carry their own cost (source column "Product Costing").
-- Without it the dashboard understates COGS and overstates margin.
ALTER TABLE jewellery_orders ADD COLUMN IF NOT EXISTS product_cost numeric(14,2);
