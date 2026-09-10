-- Jewellery orders were imported from the workbook's "Jewellery Master" sheet
-- and never became part of the working flow: stock, sales, accounts, masters.
-- The only reader was the dashboard's profit-by-business panel, which went
-- with it.
--
-- The client receivables from those sales are NOT touched. They live in
-- `ledger` with ref_type='jewellery' and are real money owed. Only the order
-- header table goes.
DROP TABLE IF EXISTS jewellery_orders;
