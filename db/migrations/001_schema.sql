CREATE TABLE parties (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  kind        text NOT NULL DEFAULT 'both' CHECK (kind IN ('supplier','client','both')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_no      text NOT NULL UNIQUE,
  party_id    uuid REFERENCES parties(id),
  stone_type  text NOT NULL,
  shape       text,
  sieve_size  text,
  mm_size     text,
  clarity     text,
  colour      text,
  cost_rate   numeric(14,4),
  source      text NOT NULL DEFAULT 'purchase'
                CHECK (source IN ('purchase','memo_in','opening','legacy_selflot')),
  opened_on   date,
  notes       text
);

CREATE TABLE memos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_no    text NOT NULL UNIQUE,
  direction  text NOT NULL CHECK (direction IN ('in','out')),
  party_id   uuid NOT NULL REFERENCES parties(id),
  issued_on  date NOT NULL,
  due_on     date,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes      text
);

-- One row per lot on a memo. Partial settlements append movements against the
-- line; the line closes only once fully returned and/or billed.
CREATE TABLE memo_lines (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id  uuid NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  lot_id   uuid NOT NULL REFERENCES lots(id),
  carats   numeric(10,3) NOT NULL CHECK (carats > 0),
  rate     numeric(14,4) NOT NULL CHECK (rate >= 0),
  status   text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled'))
);
CREATE INDEX memo_lines_memo_idx ON memo_lines (memo_id);

CREATE TABLE movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id        uuid NOT NULL REFERENCES lots(id),
  kind          text NOT NULL CHECK (kind IN (
                  'purchase','memo_in_receipt','memo_out_return','adjust_in',
                  'sale','memo_out_issue','memo_in_return','consumed_jewellery','adjust_out')),
  carats        numeric(10,3) NOT NULL CHECK (carats <> 0),
  rate          numeric(14,4),
  amount        numeric(14,2),
  memo_line_id  uuid REFERENCES memo_lines(id),
  ref_type      text,
  ref_id        text,
  moved_on      date NOT NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Sign must agree with kind. This is the invariant the whole app rests on.
  CONSTRAINT movement_sign CHECK (
    (kind IN ('purchase','memo_in_receipt','memo_out_return','adjust_in') AND carats > 0)
    OR
    (kind IN ('sale','memo_out_issue','memo_in_return','consumed_jewellery','adjust_out') AND carats < 0)
  )
);
CREATE INDEX movements_lot_idx ON movements (lot_id);
CREATE INDEX movements_date_idx ON movements (moved_on);
CREATE INDEX movements_memo_line_idx ON movements (memo_line_id);

CREATE TABLE ledger (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id  uuid NOT NULL REFERENCES parties(id),
  kind      text NOT NULL CHECK (kind IN
              ('purchase_invoice','sale_invoice','payment_in','payment_out','adjustment')),
  amount    numeric(14,2) NOT NULL,
  dated_on  date NOT NULL,
  ref_type  text,
  ref_id    text,
  notes     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Positive = they owe us. Negative = we owe them.
  CONSTRAINT ledger_sign CHECK (
    (kind IN ('sale_invoice','payment_out') AND amount > 0)
    OR
    (kind IN ('purchase_invoice','payment_in') AND amount < 0)
    OR kind = 'adjustment'
  )
);
CREATE INDEX ledger_party_idx ON ledger (party_id);
CREATE INDEX ledger_date_idx ON ledger (dated_on);

CREATE TABLE memo_line_billings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_line_id uuid NOT NULL REFERENCES memo_lines(id) ON DELETE CASCADE,
  carats       numeric(10,3) NOT NULL CHECK (carats > 0),
  amount       numeric(14,2) NOT NULL,
  invoice_no   text NOT NULL,
  billed_on    date NOT NULL
);
CREATE INDEX memo_line_billings_line_idx ON memo_line_billings (memo_line_id);

CREATE TABLE jewellery_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no       text NOT NULL UNIQUE,
  ordered_on     date,
  party_id       uuid REFERENCES parties(id),
  product_type   text,
  metal_type     text,
  metal_colour   text,
  gross_wt       numeric(10,3),
  net_wt         numeric(10,3),
  metal_rate     numeric(14,4),
  metal_amount   numeric(14,2),
  labour_amount  numeric(14,2),
  other_charges  numeric(14,2),
  client_total   numeric(14,2),
  remarks        text
);
