-- The funnel, stored rather than implied.
--
-- Every rupee in `ledger` knew its amount, its party and a text bill number.
-- It did not know WHICH goods caused it. That gap is what makes a system feel
-- like a spreadsheet: the numbers line up only because a human believes they
-- do. These three columns close it, and `bill_trail` reads the chain back.

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS memo_line_id        uuid REFERENCES memo_lines(id);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS requirement_line_id uuid REFERENCES requirement_lines(id);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS lot_id              uuid REFERENCES lots(id);

CREATE INDEX IF NOT EXISTS ledger_memo_line_idx ON ledger (memo_line_id) WHERE memo_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_req_line_idx  ON ledger (requirement_line_id) WHERE requirement_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_lot_idx       ON ledger (lot_id) WHERE lot_id IS NOT NULL;

-- Rows written before these columns existed carried the link as loose text.
UPDATE ledger SET requirement_line_id = ref_id::uuid
 WHERE ref_type = 'requirement_line' AND requirement_line_id IS NULL
   AND ref_id ~ '^[0-9a-f-]{36}$';

-- ------------------------------------------------- one-time test-data removal
-- Four memo billings were entered while testing ('blah123', 'blah1234', 'no1').
-- They posted receivables and payables with NO bill number, which the bills
-- view shows as unnumbered documents and `recordPayment` can never settle,
-- because it matches on bill_no.
--
-- These are DELETED, not reversed, and the append-only trigger is lifted to do
-- it. That is deliberate and it is the only place in this schema where it
-- happens: `ledger_sign` forbids a negative sale_invoice, so a true reversing
-- row is impossible, and an `adjustment` row is ignored by the bills view --
-- the phantom document would survive its own reversal. None of the four moved
-- carats into stock (their vault balance was already zero), so removing the
-- billing rows simply reopens the memo lines they closed.
ALTER TABLE ledger DISABLE TRIGGER ledger_no_mutate;

DELETE FROM ledger
 WHERE ref_type = 'memo_line'
   AND bill_no IS NULL
   AND ref_id IN (SELECT invoice_no FROM memo_line_billings
                   WHERE invoice_no IN ('blah123', 'blah1234', 'no1'));

ALTER TABLE ledger ENABLE TRIGGER ledger_no_mutate;

UPDATE memo_lines SET status = 'open'
 WHERE id IN (SELECT memo_line_id FROM memo_line_billings
               WHERE invoice_no IN ('blah123', 'blah1234', 'no1'));
UPDATE memos SET status = 'open'
 WHERE id IN (SELECT memo_id FROM memo_lines
               WHERE id IN (SELECT memo_line_id FROM memo_line_billings
                             WHERE invoice_no IN ('blah123', 'blah1234', 'no1')));
DELETE FROM memo_line_billings WHERE invoice_no IN ('blah123', 'blah1234', 'no1');

-- --------------------------------------------------------------- the rule
-- A bill that claims goods must point at the goods. Charges with nothing
-- behind them are still legitimate -- brokerage, freight, certification -- but
-- they have to say so (`ref_type = 'bill'`, what recordBill writes) instead of
-- being an invoice from nowhere. NOT VALID: the imported historical book keeps
-- its own shape, only new rows are held to this.
ALTER TABLE ledger DROP CONSTRAINT IF EXISTS ledger_goods_backed;
ALTER TABLE ledger ADD CONSTRAINT ledger_goods_backed CHECK (
  kind NOT IN ('sale_invoice', 'purchase_invoice')
  OR lot_id IS NOT NULL
  OR memo_line_id IS NOT NULL
  OR ref_type IN ('bill', 'diamond_hisab')
) NOT VALID;

-- ------------------------------------------------------------- the trail
-- One row per ledger line, with everything behind it resolved: the memo it
-- settled, the requirement it served, the parcel it came out of.
CREATE OR REPLACE VIEW bill_trail AS
SELECT
  g.id                AS ledger_id,
  g.party_id,
  g.bill_no,
  g.kind,
  g.dated_on::text    AS dated_on,
  g.amount,
  g.notes,
  CASE WHEN g.kind IN ('sale_invoice','payment_in') THEN 'sale' ELSE 'purchase' END AS direction,
  m.memo_no,
  m.direction         AS memo_direction,
  m.issued_on::text   AS memo_issued_on,
  ml.carats           AS memo_line_carats,
  r.requirement_no,
  rp.name             AS requirement_party,
  COALESCE(lot.lot_no, memo_lot.lot_no)         AS lot_no,
  COALESCE(lot.stone_type, memo_lot.stone_type) AS stone_type,
  COALESCE(lot.shape, memo_lot.shape)           AS shape,
  COALESCE(lot.sieve_size, memo_lot.sieve_size) AS sieve_size,
  COALESCE(lot.mm_size, memo_lot.mm_size)       AS mm_size,
  COALESCE(lot.colour, memo_lot.colour)         AS colour,
  COALESCE(lot.clarity, memo_lot.clarity)       AS clarity,
  COALESCE(lot.lab, memo_lot.lab)               AS lab,
  COALESCE(lot.certified, memo_lot.certified)   AS certified
FROM ledger g
LEFT JOIN memo_lines        ml ON ml.id = g.memo_line_id
LEFT JOIN memos             m  ON m.id  = ml.memo_id
LEFT JOIN lots              memo_lot ON memo_lot.id = ml.lot_id
LEFT JOIN lots              lot ON lot.id = g.lot_id
LEFT JOIN requirement_lines rl ON rl.id = COALESCE(g.requirement_line_id, ml.requirement_line_id)
LEFT JOIN requirements      r  ON r.id  = rl.requirement_id
LEFT JOIN parties           rp ON rp.id = r.party_id;
