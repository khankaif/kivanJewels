-- Catalog diamond prices: the client's "Client 3 SP" price list, per carat.
-- Catalog only: the ERP never reads these (a trader types the rate there).
--
-- Built on the masters, never beside them:
--  * a quality option is a colour and a clarity already in the grade master
--    (EF + VVS-VS) -- the pair a shopper picks, not a new free-text label;
--  * a price is (stone type, size, quality) -> rupees per carat.
-- So renaming EF in the master renames it here too, and a value or size that
-- is priced cannot be deleted out from under its prices (retire it instead).
--
-- One price list, so no list column: a second list is one added column with
-- a default, when it exists.

CREATE TABLE quality_options (
  colour     text NOT NULL REFERENCES colours(name)   ON UPDATE CASCADE,
  clarity    text NOT NULL REFERENCES clarities(name) ON UPDATE CASCADE,
  sort_order int     NOT NULL DEFAULT 0,
  -- Retired options leave the price grid and the catalog; their prices stay.
  active     boolean NOT NULL DEFAULT true,
  PRIMARY KEY (colour, clarity)
);

-- The qualities the client's sheets price today.
INSERT INTO quality_options (colour, clarity, sort_order) VALUES
  ('EF','VVS-VS',1), ('EF','VS-SI',2), ('GH','SI',3);

CREATE TABLE diamond_prices (
  stone_type   text NOT NULL REFERENCES stone_types(name)  ON UPDATE CASCADE,
  size_id      text NOT NULL REFERENCES diamond_sizes(id)  ON UPDATE CASCADE,
  colour       text NOT NULL,
  clarity      text NOT NULL,
  price_per_ct numeric(12,2) NOT NULL CHECK (price_per_ct > 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT NULLIF(current_setting('app.actor', true), ''),
  -- One price per stone type, size and quality: a second is a conflict, not a row.
  PRIMARY KEY (stone_type, size_id, colour, clarity),
  FOREIGN KEY (colour, clarity) REFERENCES quality_options(colour, clarity) ON UPDATE CASCADE
);
CREATE INDEX diamond_prices_size_idx ON diamond_prices (size_id);
