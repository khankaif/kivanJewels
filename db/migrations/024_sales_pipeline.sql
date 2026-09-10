-- Where a sale actually stands, computed rather than typed.
--
-- Nothing here is a status column an operator has to remember to move. Every
-- stage falls out of what already exists: carats sitting on a customer memo,
-- carats ordered from a supplier and not arrived, and whether the shelf holds
-- enough of the spec to fill what is left.
CREATE OR REPLACE VIEW requirement_pipeline AS
WITH per_line AS (
  SELECT
    rls.requirement_id,
    rls.line_id,
    GREATEST(rls.outstanding, 0) AS outstanding,
    rls.sourced_pending,
    -- Out with the customer on approval: neither returned nor billed yet.
    COALESCE((
      SELECT SUM(mls.outstanding) FROM memo_line_status mls
      WHERE mls.direction = 'out'
        AND mls.line_id IN (SELECT id FROM memo_lines WHERE requirement_line_id = rls.line_id)
    ), 0) AS on_approval,
    COALESCE((
      SELECT SUM(b.balance) FROM lot_balances b JOIN lots l ON l.id = b.lot_id
      WHERE l.unit_key = rls.unit_key AND b.balance > 0.0005
    ), 0) AS in_stock
  FROM requirement_line_status rls
  WHERE rls.line_status = 'open'
)
SELECT
  r.id, r.requirement_no, r.party_id, p.name AS party_name,
  r.raised_on::text AS raised_on, r.agent, r.status,
  (CURRENT_DATE - r.raised_on)::int          AS age_days,
  COALESCE(SUM(pl.outstanding), 0)           AS outstanding,
  COALESCE(SUM(pl.on_approval), 0)           AS on_approval,
  COALESCE(SUM(pl.sourced_pending), 0)       AS sourced_pending,
  COALESCE(bool_and(pl.in_stock >= pl.outstanding - 0.0005), true) AS covered,
  count(pl.line_id)::int                     AS open_lines,
  CASE
    -- Goods with the customer outrank everything: that is the carats at risk.
    WHEN COALESCE(SUM(pl.on_approval), 0) > 0.0005                     THEN 'approval'
    WHEN r.status = 'closed' OR COALESCE(SUM(pl.outstanding), 0) <= 0.0005 THEN 'closed'
    WHEN COALESCE(SUM(pl.sourced_pending), 0) > 0.0005                 THEN 'sourcing'
    WHEN bool_and(pl.in_stock >= pl.outstanding - 0.0005)              THEN 'ready'
    ELSE 'new'
  END AS stage
FROM requirements r
JOIN parties p ON p.id = r.party_id
LEFT JOIN per_line pl ON pl.requirement_id = r.id
GROUP BY r.id, r.requirement_no, r.party_id, p.name, r.raised_on, r.agent, r.status;
