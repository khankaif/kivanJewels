Data removed from the live database, kept because it cannot be recovered from
the schema or the migrations.

- `jewellery_orders.json` — the 35 order headers dropped by migration 019.
  Their client receivables were NOT dropped: those are `ledger` rows with
  `ref_type='jewellery'` and are still live.
