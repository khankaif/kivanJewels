/**
 * Public barrel for the ledger. Import from here, not from the concern files —
 * this is the surface the app and the tests are written against.
 *
 *   core.ts   transaction plumbing + insertMovement (the only writer)
 *   stock.ts  owned units and purchases
 *   memos.ts  goods on approval, both directions, and settlement
 *   money.ts  direct sale off a lot, and payments
 */
export {
  OverdrawError, SettlementError, insertMovement, lotBalance, lotExposure,
  type Ctx, type Entry, type MovementKind,
} from './core';
export { type Spec, unitLot, recordPurchase } from './stock';
export {
  type MemoDirection, type MemoLineInput, type InwardLineInput,
  receiveInwardMemo, issueOutwardMemo, memoLineOutstanding, returnFromMemo, billMemoLine,
} from './memos';
export { type PaymentMode, recordBill, recordDirectSale, recordPayment } from './money';
