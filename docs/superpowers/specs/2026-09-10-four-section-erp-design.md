# Four-section ERP: debloat and speed

Status: approved 2026-09-10. Supersedes the navigation shape set in
`plans/2026-08-28-ux-cx-plan.md`.

## Why

The owner described the business as four flows: Stock, Sales, Accounts,
Masters. Every one of those flows is already implemented — owned vs memo
stock, requirements fulfilled from stock or sourced from the market,
memo-or-bill in both directions, ledger with aging and bills, party and
diamond masters. Nothing in the domain is missing.

What is wrong is the surface. Navigation carries six groups and eleven
links for four flows; memos have three homes; and several tables, panels
and scripts exist only because the data arrived from a spreadsheet import
that finished months ago.

The goal is not new capability. It is: fewer places to look, and entry
faster than the spreadsheet it replaced.

## Scope

In: navigation and page structure, deletion of import-era artifacts, a
command palette, entry ergonomics.

Out: the movement and money ledger semantics, the schema for stock, memos,
requirements and bills. Those are correct and stay untouched.

## 1. Page map

Five flat top-level links. No dropdown menus.

```
Today | Stock | Sales | Accounts | Masters
```

Each section is one route. Sub-views are tabs driven by a `?tab=` search
param, so the server renders only the active tab, and tab state survives a
search or filter submit.

| Section    | Route       | Tabs                                              |
|------------|-------------|---------------------------------------------------|
| Today      | `/`         | —                                                 |
| Stock      | `/stock`    | My stock · On memo · Movements                    |
| Sales      | `/sales`    | Requirements · Out on memo                        |
| Accounts   | `/accounts` | Balances & aging · Bills · Every entry            |
| Masters    | `/parties`  | Parties · Diamonds                                |

Detail routes are unchanged: `/stock/[lotNo]`, `/sales/[requirementNo]`,
`/parties/[id]`, `/accounts/bills/[key]`.

Two sections keep sub-routes rather than a `?tab=` param, because they
already have them and moving them would break links for no gain:

- **Accounts** already renders `AccountsNav` above `/accounts` and
  `/accounts/bills`. It gains a third link, "Every entry", pointing at
  `/accounts/bills?grain=entries` — the grain switch that page already has.
- **Masters** keeps `/parties` and `/masters/diamonds`. A `MastersNav`
  built from the same component renders above both, and the top-level
  Masters link points at `/parties`. `/parties/[id]` is referenced from six
  places; it does not move.

### Where memos go

Memos stop being a place. They are a state that goods are in, so each
direction is shown where those goods live:

- **Inward** (held from a supplier, not yours yet) → Stock, "On memo" tab.
  Settle, return and bill actions live there.
- **Outward** (out with a client, not sold yet) → Sales, "Out on memo" tab.
  Return and bill actions live there.

`MemoList` and `SettleLineDialog` are reused unchanged; only their mount
point moves. The `/memos` route is deleted.

### Where purchases go

There is no Purchases section. Goods arriving on a bill and goods arriving
on a memo both enter through the existing "Add diamonds" sheet on Stock,
which already handles both. Purchase bills are the Accounts bills tab
filtered to `direction=purchase` — the same table, not a second one.

`/movements` is deleted as a top-level route; its table becomes the Stock
"Movements" tab. Per-lot history already lives on `/stock/[lotNo]` and is
unaffected.

## 2. Deletions

| Deleted | Reason |
|---|---|
| `jewellery_orders` table | Not one of the four flows. Only reader is the profit-by-business panel, also deleted. |
| Jewellery block in `scripts/import.ts` | Writes only the dropped table. |
| `getSegments()` and the "Profit by business" panel | An import-era reconciliation view of a spreadsheet, not a working tool. |
| `scripts/reconcile.ts`, `lib/reconcile.ts`, `tests/reconcile.test.ts`, `npm run reconcile` | Proved the import matched the workbook. The import is done. |
| `scripts/backfill-bills.ts`, `npm run backfill-bills` | One-time backfill, already run. |
| `app/(app)/memos/page.tsx`, `app/(app)/movements/page.tsx` | Replaced by tabs. |
| Dropdown machinery in `components/layout/main-nav.tsx` | Five flat links need no menus. |

Jewellery **ledger rows** (`ref_type='jewellery'`) are NOT deleted. They are
real client receivables. Only the orders table goes.

### Replacing getSegments without losing the headline numbers

Today's Revenue and Gross profit cards are fed by `getSegments()`. It is
replaced by a single `getPnl()` over the whole book:

- `revenue` = all `sale_invoice` rows.
- `costedRevenue` = sales from lots that have a `purchase` movement.
- `cost` = purchase amounts for those lots.
- `profit` = `costedRevenue - cost`; `markup` = profit over cost, matching
  the sheet's Profit % column.
- `uncosted` = `revenue - costedRevenue`.

Jewellery revenue has no costed movement, so it falls into `uncosted` and is
excluded from profit — the same treatment the workbook gives it, reached
without reading `jewellery_orders` at all. The panel's caveat prose is
deleted along with the panel; one line under the profit card states that
uncosted sales are excluded.

## 3. Command palette

Opened with Cmd/Ctrl-K from anywhere. One dialog component, one server
action for search. No new tables.

**Search** (single query over existing views, results grouped):

- stock units from `lot_balances` — sieve, mm, shape, colour, clarity
- parties from `parties` — name, business name
- bills from the `bills` view — bill number, party
- requirements from `requirement_line_status` — requirement number, party

Each hit links to its detail route.

**Actions**, listed when the query is empty and filtered as it is typed:
Add diamonds · New requirement · New party.

Selecting an action navigates to the owning page with `?new=1`; the page
passes `defaultOpen` to its sheet. Recording a payment is deliberately not
an action: a payment needs a party first, so the path is to search the
party and pay from their page.

## 4. Entry ergonomics

Applied to `AddStockSheet`, `RequirementForm`, `FulfilSheet`,
`PaymentDialog`, `PartyDialog`:

- first field autofocused on open
- Enter submits; Escape closes
- **Save & add another** on Add diamonds and on requirement lines — keeps
  the sheet open, clears amounts, keeps party and date
- date defaults to today; party defaults to the last one used in that sheet
  (per-browser, `localStorage`)

## 5. Already built, only re-pointed

Two of the four ease-of-use asks are done and are not rebuilt:

- **Party history** — `/parties/[id]` has statement, unpaid bills, memos.
- **What to chase** — `getWorklist()` ranks overdue memos, open memos,
  requirements and late bills.

Worklist `href`s currently point at `/memos`; they are repointed to
`/stock?tab=memo` and `/sales?tab=memo`. This is the only change either
needs.

## 6. Testing

- `tests/worklist.test.ts` extended: every worklist `href` resolves to a
  route that exists.
- New `tests/palette.test.ts`: the search returns a stock unit, a party, a
  bill and a requirement for queries that should match each, and nothing for
  one that should not.
- New migration `019_drop_jewellery_orders.sql`; the suite must still pass
  against a freshly migrated database, proving nothing references the table.
- `npm run typecheck` and `npm run test` green. `tests/reconcile.test.ts` is
  deleted with the module it tests.

## Risks

- **Dropping `jewellery_orders` is irreversible.** The source workbook is in
  the repo and the migration is additive-free, so the data can be
  re-imported if it is ever wanted. Confirmed as intended.
- Tab-per-section means one route renders several very different tables.
  Guard: each tab's markup stays in its own component file; the route
  picks one and passes data.
