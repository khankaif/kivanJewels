-- A requirement line now records HOW it is meant to be filled, not just what
-- was asked for: part off the shelf, part bought in. Both halves are common on
-- one line, and until now the split existed only in the operator's head --
-- the requirement was raised on one screen and fulfilled on another.

ALTER TABLE requirement_lines
  ADD COLUMN IF NOT EXISTS plan_stock  numeric(10,3) CHECK (plan_stock  IS NULL OR plan_stock  >= 0),
  ADD COLUMN IF NOT EXISTS plan_source numeric(10,3) CHECK (plan_source IS NULL OR plan_source >= 0);

-- Same view as 017, plus the plan. Delivery is still measured from movements:
-- the plan is intent, the movements are truth.
CREATE OR REPLACE VIEW requirement_line_status AS
WITH d AS (
  SELECT
    rl.id AS line_id,
    COALESCE((
      SELECT SUM(ml.carats
                 - COALESCE((SELECT SUM(ABS(mv.carats)) FROM movements mv
                             WHERE mv.memo_line_id = ml.id AND mv.kind = 'memo_out_return'), 0))
      FROM memo_lines ml JOIN memos mo ON mo.id = ml.memo_id
      WHERE ml.requirement_line_id = rl.id AND mo.direction = 'out'
    ), 0) AS delivered_memo,
    COALESCE((
      SELECT SUM(ABS(mv.carats)) FROM movements mv
      WHERE mv.kind = 'sale' AND mv.ref_type = 'requirement_line' AND mv.ref_id = rl.id::text
    ), 0) AS delivered_direct,
    COALESCE((
      SELECT SUM(mls.outstanding) FROM memo_line_status mls
      WHERE mls.direction = 'in'
        AND mls.line_id IN (SELECT id FROM memo_lines WHERE requirement_line_id = rl.id)
    ), 0) AS sourced_pending
  FROM requirement_lines rl
)
SELECT
  rl.id             AS line_id,
  rl.requirement_id,
  r.requirement_no,
  r.party_id,
  p.name            AS party_name,
  r.raised_on::text AS raised_on,
  r.agent,
  r.status          AS requirement_status,
  rl.stone_type, rl.shape, rl.sieve_size, rl.mm_size, rl.colour, rl.clarity,
  rl.unit_key,
  rl.carats         AS wanted,
  rl.quoted_rate,
  rl.status         AS line_status,
  d.delivered_memo,
  d.delivered_direct,
  d.sourced_pending,
  d.delivered_memo + d.delivered_direct              AS delivered,
  rl.carats - d.delivered_memo - d.delivered_direct  AS outstanding,
  rl.plan_stock,
  rl.plan_source
FROM requirement_lines rl
JOIN requirements r ON r.id = rl.requirement_id
JOIN parties      p ON p.id = r.party_id
JOIN d ON d.line_id = rl.id;
