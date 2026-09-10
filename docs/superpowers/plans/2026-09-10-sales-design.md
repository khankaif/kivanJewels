# Sales — customer requirements, fulfilment from stock or market

**Approved in chat 2026-09-10.** Approach A of three (see session). Build directly, no separate plan doc.

## Problem

A broker gets a customer requirement, fulfils it from owned stock and/or by sourcing
from the market (on bill or on memo), and delivers to the customer on memo or on bill.
Today there is no requirement entity, and no direct sale — the `sale` movement kind
exists but nothing in the app creates it.

## Data model

**`requirements`** — one customer ask: `id`, `requirement_no` (`REQ-<seq>`, auto),
`party_id` → customer, `raised_on`, `agent`, `status` (`open`/`closed`), `notes`,
`created_at`.

**`requirement_lines`** — one spec on that ask: `id`, `requirement_id` (CASCADE),
spec fields (`stone_type`, `shape`, `sieve_size`, `mm_size`, `colour`, `clarity`),
`unit_key` GENERATED from `lot_unit_key(...)`, `carats` (wanted, `> 0`),
`quoted_rate` (nullable), `status` (`open`/`closed`), `notes`.

**`memo_lines.requirement_line_id`** — nullable FK. Outward link = a delivery;
inward link = sourcing for the requirement.

**Direct sale — no new table.** `recordDirectSale` writes a `sale` movement
(−carats) + a `sale_invoice` ledger row, both tagged
`ref_type='requirement_line', ref_id=<line>`. The `bills` view already turns
`sale_invoice` rows into documents.

**`requirement_line_status`** view:
- `wanted` = `carats`
- `delivered` = Σ linked outward memo-line carats (net `memo_out_return`) + Σ tagged `sale` movements
- `outstanding` = `wanted − delivered`
- `sourced_pending` = Σ `outstanding` of linked inward memo lines

Requirement auto-closes when every line's `outstanding ≤ 0` (mirrors `closeIfSettled`);
a client return reopens a closed line.

## Fulfilment flow

Two action families on a line with `outstanding > 0`:

**Deliver** — pick lot, carats, rate (defaults `quoted_rate`), channel:
| channel | primitive | needs |
|---|---|---|
| memo | `issueOutwardMemo` + `requirementLineId` | customer memo no, due date |
| bill | `recordDirectSale` *(new)* | invoice no |

**Source** — pick supplier, carats, rate, channel:
| channel | primitive | lands in | needs |
|---|---|---|---|
| memo | `receiveInwardMemo` + `requirementLineId` | memo stock | supplier memo no, terms |
| bill | `recordPurchase` + tag | owned unit | supplier, bill no (optional) |

**Close short** — abandon the remainder, line → `closed`.

Memo deliveries settle on `/memos` as today. Substitution (non-matching lot) and
over-delivery are both allowed; picker defaults to matching stock with a show-all toggle.

## Known limitation

Direct sale is firm — no `sale_return` movement kind. If a customer may return,
deliver on memo. A direct-sale reversal is a manual `adjust_in` + ledger adjustment.

## Lib changes

- **New** `recordDirectSale({ lotId, carats, rate, on, invoiceNo, partyId, requirementLineId? })`.
- **Extend** `issueOutwardMemo`, `receiveInwardMemo`, `recordPurchase` with optional `requirementLineId`.

## UI

- `/sales` — pipeline: open requirements, per line wanted/outstanding + in-stock badge.
- `/sales/[requirementNo]` — detail, per line a **Fulfil** sheet (Deliver / Source toggle).
- Create requirement: header + repeatable spec lines, diamond-master datalists.
- Nav: one link, no regroup.

## Cleanup (bundled)

- Remove unused `getSetupStatus` / `SetupStatus` (`features/dashboard/queries.ts`).
- Remove unused `lib/auth/client.ts` (`authClient` referenced nowhere).
- No dead tables: `jewellery_orders` is load-bearing for the accounts P&L and the
  reconciliation gate.

## Tests — `tests/sales.test.ts`

`recordDirectSale` decrements the lot / posts the receivable / hits the overdraw guard;
`wanted − delivered = outstanding` across mixed channels; `delivered` net of returns and
a return reopens the line; back-to-back both-linked auto-close; `sourced_pending` tracks
linked inward outstanding; over-delivery closes without error; multi-line view arithmetic.
