-- 029's goods rule never fired. `ref_type = ANY (...)` evaluates to NULL when
-- ref_type is NULL, and a CHECK constraint rejects only FALSE -- so an invoice
-- with no goods, no memo and no ref_type passed straight through the rule
-- written to stop it. COALESCE forces a real boolean.
ALTER TABLE ledger DROP CONSTRAINT IF EXISTS ledger_goods_backed;
ALTER TABLE ledger ADD CONSTRAINT ledger_goods_backed CHECK (
  kind NOT IN ('sale_invoice', 'purchase_invoice')
  OR lot_id IS NOT NULL
  OR memo_line_id IS NOT NULL
  OR COALESCE(ref_type, '') IN ('bill', 'diamond_hisab')
) NOT VALID;
