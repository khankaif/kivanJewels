/**
 * Your own letterhead, for printed bills and memos. Set once in the
 * environment; until then documents print with the trading name only.
 */
export const business = {
  name: process.env.BUSINESS_NAME || 'Kaivan Jewels',
  address: process.env.BUSINESS_ADDRESS || '',
  gstin: process.env.BUSINESS_GSTIN || '',
  phone: process.env.BUSINESS_PHONE || '',
};
