-- The import built lot_no as 'DH-' || _id, but _id already carried the prefix,
-- producing 'DH-DH-120'. Harmless internally, but these are user-visible on the
-- bill drill-down. Collapse the doubled prefix; the KS lots have the same issue.
UPDATE lots SET lot_no = 'DH-' || substring(lot_no from 7) WHERE lot_no LIKE 'DH-DH-%';
UPDATE lots SET lot_no = 'KS-' || substring(lot_no from 7) WHERE lot_no LIKE 'KS-KS-%';
