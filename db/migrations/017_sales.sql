-- Sales: a customer requirement, fulfilled from owned stock and/or by sourcing
-- from the market. See docs/superpowers/plans/2026-09-10-sales-design.md.

CREATE SEQUENCE requirement_seq;

CREATE TABLE requirements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_no text NOT NULL UNIQUE DEFAULT ('REQ-' || nextval('requirement_seq')),
  party_id       uuid NOT NULL REFERENCES parties(id),
  raised_on      date NOT NULL,
  agent          text,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX requirements_status_idx ON requirements (status);

CREATE TABLE requirement_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  stone_type     text NOT NULL DEFAULT 'Lab Grown',
  shape          text,
  sieve_size     text,
  mm_size        text,
  colour         text,
  clarity        text,
  -- Same identity as owned stock, so "do I have this?" is an index lookup.
  unit_key       text GENERATED ALWAYS AS
                   (lot_unit_key(shape, sieve_size, mm_size, colour, clarity)) STORED,
  carats         numeric(10,3) NOT NULL CHECK (carats > 0),
  quoted_rate    numeric(14,4),
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes          text
);
CREATE INDEX requirement_lines_req_idx ON requirement_lines (requirement_id);
CREATE INDEX requirement_lines_unit_idx ON requirement_lines (unit_key) WHERE status = 'open';

-- One nullable link, both directions: an OUTWARD memo line points at the
-- requirement it delivers; an INWARD one at the requirement it sources for.
ALTER TABLE memo_lines ADD COLUMN requirement_line_id uuid REFERENCES requirement_lines(id);
CREATE INDEX memo_lines_requirement_idx ON memo_lines (requirement_line_id)
  WHERE requirement_line_id IS NOT NULL;

-- Direct sales carry no table of their own: a 'sale' movement + a 'sale_invoice'
-- ledger row, both tagged ref_type='requirement_line'. Mirrors how billMemoLine
-- writes straight to the ledger; the bills view already documents these rows.

CREATE VIEW requirement_line_status AS
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
  rl.carats - d.delivered_memo - d.delivered_direct  AS outstanding
FROM requirement_lines rl
JOIN requirements r ON r.id = rl.requirement_id
JOIN parties      p ON p.id = r.party_id
JOIN d ON d.line_id = rl.id;
