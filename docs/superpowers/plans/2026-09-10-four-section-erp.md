# Four-Section ERP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse an eleven-link, six-group ERP into five sections that match how the business actually works, delete the spreadsheet-import leftovers, and make entry faster than the spreadsheet was.

**Architecture:** Nothing in the ledger, stock, memo, requirement or bill schema changes. The work is: five flat nav links; sub-views become `?tab=` params rendered server-side; memo lists move to the section that owns the goods; one migration drops a dead table; a Cmd-K palette adds search and jump-to-entry.

**Tech Stack:** Next.js 16 App Router (server components by default), React 19, TypeScript, Tailwind v4, Base UI primitives wrapped in `components/ui/*`, Neon serverless Postgres via `db/client.ts` (`sql` tagged template, `withTx`), node:test via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-10-four-section-erp-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before writing route code. This Next.js version differs from training data — `searchParams` and `params` are Promises and must be awaited.
- Server components by default. Add `'use client'` only for a component that needs state, an event handler or a browser API.
- Every page that reads the database keeps `export const dynamic = 'force-dynamic';`.
- Money and carats are `numeric` in Postgres and arrive as strings. Always `Number(r.col)` at the query boundary. Never do arithmetic on the raw value.
- Dates are calendar dates with no timezone: cast to text in SQL (`col::text`), never `new Date()` round-trips.
- No new npm dependencies. The palette is built from `components/ui/dialog.tsx` and `components/ui/input.tsx`; do not add `cmdk`.
- Tests that touch the database require `TEST_DATABASE_URL` (a separate Neon branch) and must wrap fixtures in `inRollback` from `tests/helpers.ts`. `movements` is append-only — a trigger blocks UPDATE and DELETE, so rollback is the only cleanup.
- Run `npm run typecheck` before every commit. It must pass.
- Commit messages: `type: subject` in the imperative, lowercase subject, no trailing period.

---

### Task 1: Five flat nav links

**Files:**
- Modify: `components/layout/main-nav.tsx` (whole file)
- Create: `tests/routes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `NAV: { href: string; label: string }[]` exported from `components/layout/main-nav.tsx`. Later tasks add no entries to it.

- [ ] **Step 1: Write the failing test**

Create `tests/routes.test.ts`. This test needs no database — it reads the route files off disk and checks every nav link points at one that exists.

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NAV } from '../components/layout/main-nav';

/** '/stock' -> 'app/(app)/stock/page.tsx'; '/' -> 'app/(app)/page.tsx'. */
function routeFile(href: string): string {
  const path = href.split('?')[0].replace(/^\/|\/$/g, '');
  return path ? `app/(app)/${path}/page.tsx` : 'app/(app)/page.tsx';
}

test('every nav link points at a route that exists', () => {
  for (const entry of NAV) {
    assert.ok(existsSync(routeFile(entry.href)), `${entry.href} -> ${routeFile(entry.href)} missing`);
  }
});

test('navigation is five flat sections', () => {
  assert.deepEqual(
    NAV.map((n) => n.label),
    ['Today', 'Stock', 'Sales', 'Accounts', 'Masters'],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/routes.test.ts`
Expected: FAIL — the current `NAV` is a mix of leaf links and `{ label, items }` groups, so `NAV.map(n => n.href)` yields `undefined` for the groups and the label list does not match.

- [ ] **Step 3: Replace main-nav.tsx**

The dropdown menu, the `Entry`/`Leaf` union and the `base()` helper all go. Five links, one active rule.

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Five sections, flat. Sub-views are tabs inside a section, not nav entries:
 * a menu that lists what a page already lists is a second place to be wrong.
 */
export const NAV = [
  { href: '/', label: 'Today' },
  { href: '/stock', label: 'Stock' },
  { href: '/sales', label: 'Sales' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/parties', label: 'Masters' },
] as const;

/** Masters spans two route trees; everything else owns its own prefix. */
const OWNS: Record<string, string[]> = {
  '/parties': ['/parties', '/masters'],
};

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV.map(({ href, label }) => {
        const prefixes = OWNS[href] ?? [href];
        const active = href === '/'
          ? pathname === '/'
          : prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test and the typechecker**

Run: `npx tsx --test tests/routes.test.ts && npm run typecheck`
Expected: both PASS.

- [ ] **Step 5: Check no other file imported the old shape**

Run: `grep -rn "from '@/components/layout/main-nav'" app features components`
Expected: only `app/(app)/layout.tsx`, importing `MainNav`. If anything imports `NAV` expecting groups, fix it now.

- [ ] **Step 6: Add the pure test to the fast suite**

In `package.json`, extend `test:pure` so this test runs without a database:

```json
"test:pure": "tsx --test tests/dates.test.ts tests/normalize.test.ts tests/routes.test.ts",
```

- [ ] **Step 7: Commit**

```bash
git add components/layout/main-nav.tsx tests/routes.test.ts package.json
git commit -m "refactor: five flat nav sections, no dropdowns"
```

---

### Task 2: Stock owns inward memos and the movement register

**Files:**
- Create: `lib/tabs.ts`
- Create: `components/layout/section-tabs.tsx`
- Create: `features/stock/components/owned-table.tsx` (extracted from the page)
- Create: `features/stock/components/memo-table.tsx` (extracted from the page)
- Create: `features/stock/components/movements-table.tsx` (moved from the deleted route)
- Modify: `app/(app)/stock/page.tsx`
- Delete: `app/(app)/movements/page.tsx`
- Modify: `app/(app)/stock/[lotNo]/page.tsx:29-31` (the "← All movements" link)
- Test: `tests/tabs.test.ts`

**Interfaces:**
- Consumes: `NAV` (Task 1) — unchanged.
- Produces:
  - `resolveTab<T extends string>(param: string | undefined, tabs: readonly T[]): T` from `lib/tabs.ts`
  - `SectionTabs({ items }: { items: { href: string; label: string; active: boolean }[] })` from `components/layout/section-tabs.tsx`
  - `OwnedTable({ units }: { units: StockUnit[] })`, `MemoTable({ rows }: { rows: MemoStock[] })`, `MovementsTable({ rows, total, filters }: …)` — all server components.

- [ ] **Step 1: Write the failing test for the tab resolver**

Create `tests/tabs.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTab } from '../lib/tabs';

const TABS = ['owned', 'memo', 'movements'] as const;

test('a known tab is kept', () => {
  assert.equal(resolveTab('memo', TABS), 'memo');
});

test('an unknown or missing tab falls back to the first', () => {
  assert.equal(resolveTab('nonsense', TABS), 'owned');
  assert.equal(resolveTab(undefined, TABS), 'owned');
  assert.equal(resolveTab('', TABS), 'owned');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test tests/tabs.test.ts`
Expected: FAIL — `Cannot find module '../lib/tabs'`.

- [ ] **Step 3: Write lib/tabs.ts**

```ts
/**
 * Which tab a `?tab=` param selects. Unknown values fall back to the first tab
 * rather than rendering nothing: a stale bookmark should show a page.
 */
export function resolveTab<T extends string>(param: string | undefined, tabs: readonly T[]): T {
  return tabs.includes(param as T) ? (param as T) : tabs[0];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test tests/tabs.test.ts`
Expected: PASS. Add `tests/tabs.test.ts` to the `test:pure` script alongside `tests/routes.test.ts`.

- [ ] **Step 5: Write the shared tab strip**

Create `components/layout/section-tabs.tsx`. A server component — the caller already knows which tab is active, so this needs no client state.

```tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type TabItem = { href: string; label: string; active: boolean };

export function SectionTabs({ items }: { items: TabItem[] }) {
  return (
    <div className="flex gap-1 border-b">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            t.active
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Extract the two existing stock tables into components**

Move the JSX currently inside `<TabsContent value="owned">` in `app/(app)/stock/page.tsx` into `features/stock/components/owned-table.tsx` as `OwnedTable({ units }: { units: StockUnit[] })`, and the `<TabsContent value="memo">` JSX into `features/stock/components/memo-table.tsx` as `MemoTable({ rows }: { rows: MemoStock[] })`. Carry the local `spec()` and `Empty()` helpers with them (each file gets its own copy of `spec()` — it is two lines and copying beats a barrel import). Import the row types from `@/features/stock/queries`. Do not change any markup.

- [ ] **Step 7: Move the movements register into a component**

Move the body of `app/(app)/movements/page.tsx` into `features/stock/components/movements-table.tsx` as:

```tsx
import type { MovementRow } from '@/features/stock/register';

export function MovementsTable({
  rows, total, inCarats, outCarats, sp,
}: {
  rows: MovementRow[];
  total: number;
  inCarats: number;
  outCarats: number;
  sp: Record<string, string | undefined>;
}) { /* the markup from the old page, unchanged */ }
```

`getMovements` returns `{ rows, total, inCarats, outCarats }` — all four are used by the old page's markup, so all four are props. The `FilterBar` and the in/out totals move into this component exactly as they are; the `getMovements` call moves up into the Stock page (Step 8).

The old page's `qs()` helper builds pagination links from `sp`. Keep it, but seed it with the tab so paging stays on this tab:

```tsx
const qs = (over: Record<string, string>) =>
  `/stock?${new URLSearchParams(
    Object.entries({ ...sp, tab: 'movements', ...over }).filter(([, v]) => v) as [string, string][])}`;
```

The `FilterBar` submits a GET form, so it also needs `<input type="hidden" name="tab" value="movements" />`. Check `components/layout/filter-bar.tsx` for where its hidden fields go and add it there.

- [ ] **Step 8: Rewrite the Stock page around the tab param**

`app/(app)/stock/page.tsx`. Only the active tab queries the database — that is the point of moving off the client `Tabs` component.

```tsx
import { resolveTab } from '@/lib/tabs';
import { SectionTabs } from '@/components/layout/section-tabs';
import { OwnedTable } from '@/features/stock/components/owned-table';
import { MemoTable } from '@/features/stock/components/memo-table';
import { MovementsTable } from '@/features/stock/components/movements-table';
import { getOwnedUnits, getMemoStock, getStockTotals } from '@/features/stock/queries';
import { getMovements } from '@/features/stock/register';

export const dynamic = 'force-dynamic';

const TABS = ['owned', 'memo', 'movements'] as const;
const LABELS = { owned: 'My stock', memo: 'On memo', movements: 'Movements' } as const;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = resolveTab(sp.tab, TABS);
  const totals = await getStockTotals();

  // A tab link keeps the current search but always resets paging.
  const href = (t: string) => {
    const next = new URLSearchParams(
      Object.entries({ ...sp, tab: t, page: undefined }).filter(([, v]) => v) as [string, string][],
    );
    return `/stock?${next}`;
  };
  const items = TABS.map((t) => ({ href: href(t), label: LABELS[t], active: t === tab }));

  return (
    <div className="space-y-6">
      {/* heading, the four Stat cards fed by `totals`, and the AddStockSheet — unchanged */}
      <SectionTabs items={items} />
      {tab === 'owned' && <OwnedTable units={await getOwnedUnits({ search: sp.q })} />}
      {tab === 'memo' && <MemoTable rows={await getMemoStock({ search: sp.q })} />}
      {tab === 'movements' && <MovementsTable {...await loadMovements(sp)} />}
    </div>
  );
}
```

`loadMovements` is a local async function in the same file, lifting the old page's data call verbatim:

```tsx
const MOVEMENTS_PAGE = 200;

async function loadMovements(sp: Record<string, string | undefined>) {
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total, inCarats, outCarats } = await getMovements({
    kind: sp.kind, q: sp.q, from: sp.from, to: sp.to,
    direction: sp.direction === 'in' ? 'in' : sp.direction === 'out' ? 'out' : undefined,
    limit: MOVEMENTS_PAGE, offset: (page - 1) * MOVEMENTS_PAGE,
  });
  return { rows, total, inCarats, outCarats, sp };
}
```

Keep the search `<form>`, and add `<input type="hidden" name="tab" value={tab} />` inside it so submitting the search does not throw you back to the first tab.

- [ ] **Step 9: Delete the old route and repoint its inbound link**

```bash
rm -r "app/(app)/movements"
```

In `app/(app)/stock/[lotNo]/page.tsx`, change the `href="/movements"` link (around line 29) to `href="/stock?tab=movements"`. Leave its label as "← All movements".

- [ ] **Step 10: Verify nothing still points at the dead route**

Run: `grep -rn "/movements" app features components lib tests`
Expected: no hits except the string `?tab=movements`. Fix any that remain — `features/sales/actions.ts` has `/movements` in its `PATHS` revalidation array; replace that entry with `/stock`, and delete the now-duplicate `/stock` if one results.

- [ ] **Step 11: Run the suite**

Run: `npm run typecheck && npm run test:pure && npm run test`
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: stock owns inward memos and the movement register"
```

---

### Task 3: Sales owns outward memos; /memos is deleted

**Files:**
- Modify: `app/(app)/sales/page.tsx`
- Create: `features/sales/components/requirement-list.tsx` (extracted from the page)
- Delete: `app/(app)/memos/page.tsx`
- Modify: `features/dashboard/queries.ts` (worklist hrefs)
- Modify: `features/sales/actions.ts`, `features/memos/actions.ts`, `features/stock/actions.ts`, `features/accounts/actions.ts` (revalidation paths)
- Test: `tests/worklist.test.ts` (extend)

**Interfaces:**
- Consumes: `resolveTab`, `SectionTabs` (Task 2); `MemoList({ memos, direction })` from `features/memos/components/memo-list.tsx` — used unchanged, in both Stock's memo tab and here.
- Produces: `RequirementList({ requirements }: { requirements: Requirement[] })` from `features/sales/components/requirement-list.tsx`.

- [ ] **Step 1: Write the failing test**

Append to `tests/worklist.test.ts`. This is the guard that a deleted route cannot be linked from the worklist again.

```ts
import { existsSync } from 'node:fs';
import { getWorklist } from '../features/dashboard/queries';

test('every worklist link points at a route that exists', async () => {
  const items = await getWorklist();
  assert.ok(items.length > 0, 'worklist is empty; seed the test branch first');
  for (const item of items) {
    const path = item.href.split('?')[0].replace(/^\/|\/$/g, '');
    const file = path ? `app/(app)/${path}/page.tsx` : 'app/(app)/page.tsx';
    assert.ok(existsSync(file), `${item.key} -> ${item.href} (${file}) missing`);
  }
});
```

- [ ] **Step 2: Run it to verify it fails after the delete, not before**

Run: `npx tsx -r dotenv/config --test tests/worklist.test.ts dotenv_config_path=.env.local`
Expected: PASS right now (`/memos` still exists). Delete the route in Step 3 and it goes RED — that is the failing state this test exists to catch. Run it again after Step 3 and confirm the FAIL before fixing the hrefs.

- [ ] **Step 3: Extract the requirement list, add the memo tab, delete /memos**

Move the `requirements.map(...)` card block plus the "no requirements" empty state out of `app/(app)/sales/page.tsx` into `features/sales/components/requirement-list.tsx` as `RequirementList({ requirements })`, carrying the local `spec()` helper. Then restructure the page the same way Stock was:

```tsx
const TABS = ['requirements', 'memo'] as const;
const LABELS = { requirements: 'Requirements', memo: 'Out on memo' } as const;
```

- `tab === 'requirements'` renders the existing status filter links and `<RequirementList requirements={await getRequirements({ status: active })} />`.
- `tab === 'memo'` renders `<MemoList memos={await getMemos('out')} direction="out" />`.

Build tab hrefs with the same `href()` helper written in Task 2 Step 8, pointing at `/sales`.

Then:

```bash
rm -r "app/(app)/memos"
```

`features/memos/queries.ts`, `features/memos/actions.ts` and both memo components stay exactly where they are — only the page that mounted them is gone.

- [ ] **Step 4: Run the test and watch it fail**

Run: `npx tsx -r dotenv/config --test tests/worklist.test.ts dotenv_config_path=.env.local`
Expected: FAIL — four worklist items point at `app/(app)/memos/page.tsx`, which no longer exists.

- [ ] **Step 5: Repoint the worklist hrefs**

In `features/dashboard/queries.ts`, inside `getWorklist()`:

| key | new href |
|---|---|
| `memo-out-overdue` | `/sales?tab=memo` |
| `memo-out-open` | `/sales?tab=memo` |
| `memo-in-overdue` | `/stock?tab=memo` |
| `memo-in-open` | `/stock?tab=memo` |

Leave the `sales-open` and the two bill items as they are.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx tsx -r dotenv/config --test tests/worklist.test.ts dotenv_config_path=.env.local`
Expected: PASS.

- [ ] **Step 7: Fix every remaining reference to the dead route**

Run: `grep -rn "'/memos'\|\"/memos\"\|href=\"/memos" app features components lib tests`

Each hit is one of two things. In the `PATHS` array of `features/sales/actions.ts` (and the equivalent revalidation lists in the other three action files), replace `'/memos'` with nothing — `/stock` and `/sales` are already in those lists and now cover it. In page prose (the Stock page description, the Sales page description), point the reader at the tab instead.

Re-run the grep. Expected: no hits.

- [ ] **Step 8: Run the full suite**

Run: `npm run typecheck && npm run test`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: sales owns outward memos, drop the memo register page"
```

---

### Task 4: Accounts gains an entries tab; Masters gets a section nav

**Files:**
- Modify: `features/accounts/components/accounts-nav.tsx`
- Create: `features/masters/components/masters-nav.tsx`
- Modify: `app/(app)/parties/page.tsx`, `app/(app)/masters/diamonds/page.tsx`
- Modify: `tests/routes.test.ts`

**Interfaces:**
- Consumes: `SectionTabs` (Task 2).
- Produces: `MastersNav()` — a client component, no props.

- [ ] **Step 1: Write the failing test**

Extend `tests/routes.test.ts`:

```ts
import { ACCOUNTS_TABS } from '../features/accounts/components/accounts-nav';
import { MASTERS_TABS } from '../features/masters/components/masters-nav';

test('section tabs point at routes that exist', () => {
  for (const t of [...ACCOUNTS_TABS, ...MASTERS_TABS]) {
    assert.ok(existsSync(routeFile(t.href)), `${t.href} -> ${routeFile(t.href)} missing`);
  }
});

test('accounts exposes the money register as its own tab', () => {
  assert.ok(ACCOUNTS_TABS.some((t) => t.href.includes('grain=entries')));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test tests/routes.test.ts`
Expected: FAIL — `ACCOUNTS_TABS` is not exported and `masters-nav` does not exist.

- [ ] **Step 3: Rewrite accounts-nav.tsx on top of SectionTabs**

```tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { SectionTabs } from '@/components/layout/section-tabs';

export const ACCOUNTS_TABS = [
  { href: '/accounts', label: 'Balances & aging' },
  { href: '/accounts/bills', label: 'Bills' },
  { href: '/accounts/bills?grain=entries', label: 'Every entry' },
] as const;

export function AccountsNav() {
  const pathname = usePathname();
  const entries = useSearchParams().get('grain') === 'entries';

  return (
    <SectionTabs
      items={ACCOUNTS_TABS.map((t) => {
        const active =
          t.href === '/accounts'
            ? pathname === '/accounts'
            : pathname === '/accounts/bills' || pathname.startsWith('/accounts/bills/')
              ? t.href.includes('grain=entries') === entries
              : false;
        return { href: t.href, label: t.label, active };
      })}
    />
  );
}
```

- [ ] **Step 4: Write masters-nav.tsx**

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { SectionTabs } from '@/components/layout/section-tabs';

export const MASTERS_TABS = [
  { href: '/parties', label: 'Parties' },
  { href: '/masters/diamonds', label: 'Diamonds' },
] as const;

export function MastersNav() {
  const pathname = usePathname();
  return (
    <SectionTabs
      items={MASTERS_TABS.map((t) => ({
        href: t.href,
        label: t.label,
        active: pathname === t.href,
      }))}
    />
  );
}
```

- [ ] **Step 5: Mount it on both masters pages**

Render `<MastersNav />` directly under the `<h1>` on `app/(app)/parties/page.tsx` and on `app/(app)/masters/diamonds/page.tsx`. Change both headings to `Masters` with the existing per-page description kept as the subtitle, so the two pages read as one section. Do not add a layout file — two pages do not need one, and `/parties/[id]` must not inherit the tab strip.

- [ ] **Step 6: Run the tests**

Run: `npx tsx --test tests/routes.test.ts && npm run typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: accounts entries tab, masters section nav"
```

---

### Task 5: Drop jewellery orders and the profit-by-business panel

**Files:**
- Create: `db/migrations/019_drop_jewellery_orders.sql`
- Modify: `features/accounts/queries.ts` (replace `getSegments` with `getPnl`)
- Modify: `features/dashboard/queries.ts` (`getDashboard`)
- Modify: `app/(app)/page.tsx` (delete the panel)
- Modify: `scripts/import.ts` (delete the jewellery-orders block)
- Test: `tests/pnl.test.ts` (new)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getPnl(): Promise<{ revenue: number; costedRevenue: number; cost: number; uncosted: number; profit: number; markup: number }>` from `features/accounts/queries.ts`. `getDashboard()` keeps returning `revenue`, `cost`, `uncosted`, `profit`, `markup` with the same names, and stops returning `segments`.

- [ ] **Step 1: Write the failing test**

Create `tests/pnl.test.ts`. The behaviour that matters: a sale from a lot with no recorded purchase must land in `uncosted` and must not inflate profit.

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { getPnl } from '../features/accounts/queries';

test('a sale with no recorded cost is uncosted, not pure profit', async () => {
  const before = await getPnl();

  await inRollback(async (c) => {
    const { rows: [party] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`,
      [`ZZ Pnl Party ${Date.now()}`],
    );
    const { rows: [lot] } = await c.query(
      `INSERT INTO lots (lot_no, stone_type, source, opened_on)
       VALUES ($1,'Lab Grown','opening','2024-04-01') RETURNING id`,
      [`ZZ-PNL-${Date.now()}`],
    );
    // Opening stock: an inward adjustment, deliberately NOT a purchase.
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, moved_on) VALUES ($1,'adjust_in',5,'2024-04-01')`,
      [lot.id],
    );
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
       VALUES ($1,'sale',-5,1000,5000,'2024-04-02')`,
      [lot.id],
    );
    await c.query(
      `INSERT INTO ledger (party_id, kind, amount, dated_on) VALUES ($1,'sale_invoice',5000,'2024-04-02')`,
      [party.id],
    );

    const after = await getPnl();
    assert.equal(round(after.revenue - before.revenue), 5000, 'revenue must include the sale');
    assert.equal(round(after.uncosted - before.uncosted), 5000, 'it has no cost, so it is uncosted');
    assert.equal(round(after.profit - before.profit), 0, 'and it must not move profit');
  });
});

test('jewellery_orders is gone', async () => {
  const { sql } = await import('../db/client');
  const rows = await sql`SELECT to_regclass('public.jewellery_orders') AS t`;
  assert.equal(rows[0].t, null);
});

const round = (n: number) => Math.round(n * 100) / 100;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx -r dotenv/config --test tests/pnl.test.ts dotenv_config_path=.env.local`
Expected: FAIL — `getPnl` is not exported, and `jewellery_orders` still exists.

- [ ] **Step 3: Write the migration**

Create `db/migrations/019_drop_jewellery_orders.sql`:

```sql
-- Jewellery orders were imported from the workbook's "Jewellery Master" sheet
-- and never became part of the working flow: stock, sales, accounts, masters.
-- The only reader was the dashboard's profit-by-business panel, which went
-- with it.
--
-- The client receivables from those sales are NOT touched. They live in
-- `ledger` with ref_type='jewellery' and are real money owed. Only the order
-- header table goes.
DROP TABLE IF EXISTS jewellery_orders;
```

- [ ] **Step 4: Apply it**

Run: `npm run migrate`
Expected: the migration runner reports `019_drop_jewellery_orders.sql` applied. Apply it to the test branch too — set `DATABASE_URL` to `TEST_DATABASE_URL` for one run, or run the project's usual path for migrating the test branch.

- [ ] **Step 5: Replace getSegments with getPnl**

In `features/accounts/queries.ts`, delete `getSegments`, the `Segment` type and the jewellery caveat comment block. Add:

```ts
/**
 * The whole book's P&L.
 *
 * `cost` counts only lots that have actually sold, so unsold inventory stays on
 * the balance sheet rather than in cost of sales. A sale from a lot with no
 * `purchase` movement (opening stock, or the imported jewellery sales) has no
 * cost to set against it, so it is reported as `uncosted` and excluded from
 * profit — booking it as pure profit is the one thing the workbook refused to
 * do, and this follows that.
 *
 * `markup` is profit over cost, matching the sheet's "Profit %" column.
 */
export async function getPnl() {
  const [r] = await sql`
    WITH sold AS (
      SELECT m.lot_id, ABS(m.amount) AS sale_amount,
             EXISTS (SELECT 1 FROM movements x
                     WHERE x.lot_id = m.lot_id AND x.kind = 'purchase') AS costed
      FROM movements m WHERE m.kind = 'sale'
    )
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM ledger WHERE kind='sale_invoice')       AS revenue,
      (SELECT COALESCE(SUM(sale_amount),0) FROM sold WHERE costed)                 AS costed_revenue,
      (SELECT COALESCE(SUM(p.amount),0) FROM movements p
        WHERE p.kind='purchase'
          AND EXISTS (SELECT 1 FROM movements s
                      WHERE s.lot_id = p.lot_id AND s.kind='sale'))                AS cost`;

  const revenue = Number(r.revenue);
  const costedRevenue = Number(r.costed_revenue);
  const cost = Number(r.cost);
  const profit = costedRevenue - cost;
  return {
    revenue, costedRevenue, cost,
    uncosted: revenue - costedRevenue,
    profit,
    markup: cost > 0 ? (profit / cost) * 100 : 0,
  };
}
```

- [ ] **Step 6: Rewire the dashboard query**

In `features/dashboard/queries.ts`, `getDashboard()`: import `getPnl` instead of `getSegments`, await it in the existing `Promise.all`, and spread it into the return. Delete the `segments`, `revenue`, `cost`, `uncosted`, `profit` and `markup` reductions — `getPnl` returns all of them already. Delete the "sheet's Profit %" comment that now lives in `getPnl`.

- [ ] **Step 7: Delete the panel**

In `app/(app)/page.tsx`, delete the entire final `<Card>` — the "Profit by business" heading, the `d.segments.map(...)` block, the `d.uncosted > 0` paragraph and the "Profit % is on cost…" paragraph. Under the Gross profit stat card, add its `sub` line so the exclusion is still stated:

```tsx
sub: `${pct(d.markup)} on cost` + (d.uncosted > 0 ? ` · excludes ${inr(d.uncosted)} uncosted` : ''),
```

Remove the now-unused `pct`/`inr` imports only if nothing else on the page uses them — both are still used, so leave them.

- [ ] **Step 8: Strip the import script**

In `scripts/import.ts`: delete the `jewelleryOrders` field from the result type, the `jewelleryCount` counter, the `INSERT INTO jewellery_orders …` block and `jewellery_orders` from the `TRUNCATE` list. Keep the two `ledger` inserts that follow it (`sale_invoice` and `payment_in` with `ref_type='jewellery'`) — those are the receivables the migration comment promises are preserved. Keep reading `data.jewellery_master`, since those ledger rows come from it.

- [ ] **Step 9: Run the tests**

Run: `npx tsx -r dotenv/config --test tests/pnl.test.ts dotenv_config_path=.env.local && npm run typecheck`
Expected: both PASS.

- [ ] **Step 10: Confirm the table is unreferenced**

Run: `grep -rn "jewellery_orders\|getSegments\|segments" app features lib scripts db/migrations tests | grep -v "019_drop_jewellery_orders"`
Expected: no hits.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: drop jewellery orders, one P&L for the whole book"
```

---

### Task 6: Delete the import-verification tooling

**Files:**
- Delete: `scripts/reconcile.ts`, `lib/reconcile.ts`, `tests/reconcile.test.ts`, `scripts/backfill-bills.ts`
- Modify: `package.json` (drop `reconcile` and `backfill-bills` scripts)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This task only removes.

- [ ] **Step 1: Confirm nothing else imports them**

Run: `grep -rn "lib/reconcile\|checkReconciliation\|backfill" app features lib scripts tests package.json`
Expected: hits only in the four files being deleted and the two `package.json` script lines. If anything in `app/` or `features/` imports `checkReconciliation`, STOP and report — the spec assumed these are standalone.

- [ ] **Step 2: Delete**

```bash
git rm scripts/reconcile.ts lib/reconcile.ts tests/reconcile.test.ts scripts/backfill-bills.ts
```

- [ ] **Step 3: Drop the npm scripts**

Remove the `"reconcile"` and `"backfill-bills"` lines from `package.json`.

- [ ] **Step 4: Run the full suite**

Run: `npm run typecheck && npm run test`
Expected: all PASS, with `reconcile.test.ts` no longer collected.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: drop the one-time import reconciliation tooling"
```

---

### Task 7: Command palette

**Files:**
- Create: `features/search/queries.ts`
- Create: `features/search/actions.ts`
- Create: `components/layout/command-palette.tsx`
- Modify: `app/(app)/layout.tsx` (mount it)
- Test: `tests/palette.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type Hit = { kind: 'stock' | 'party' | 'bill' | 'requirement'; label: string; sub: string; href: string }`
  - `search(q: string, limit?: number): Promise<Hit[]>` from `features/search/queries.ts`
  - `searchAction(q: string): Promise<Hit[]>` — a `'use server'` wrapper in `features/search/actions.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/palette.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';
import { search } from '../features/search/queries';

// `search` reads through the pool, so a fixture inside `inRollback` would be
// invisible to it — a rolled-back transaction holds its own connection. A
// party row has no append-only trigger, so insert and delete directly instead.
test('finds a party by name and links to its page', async () => {
  const name = `ZZ Palette Party ${Date.now()}`;
  const [party] = await sql`INSERT INTO parties (name) VALUES (${name}) RETURNING id`;
  try {
    const hits = await search('ZZ Palette Party');
    const hit = hits.find((h) => h.kind === 'party' && h.label === name);
    assert.ok(hit, 'party not found');
    assert.equal(hit.href, `/parties/${party.id}`);
  } finally {
    await sql`DELETE FROM parties WHERE id = ${party.id}`;
  }
});

test('finds a stock unit by its spec and links to the lot', async () => {
  const hits = await search('mm');
  const stock = hits.find((h) => h.kind === 'stock');
  assert.ok(stock, 'no stock hit; the test branch needs at least one owned lot');
  assert.match(stock.href, /^\/stock\//);
});

test('a query that matches nothing returns nothing', async () => {
  assert.deepEqual(await search('zzzznotathingzzzz'), []);
});

test('a blank query returns nothing rather than the whole book', async () => {
  assert.deepEqual(await search('   '), []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx -r dotenv/config --test tests/palette.test.ts dotenv_config_path=.env.local`
Expected: FAIL — `Cannot find module '../features/search/queries'`.

- [ ] **Step 3: Write the search query**

Create `features/search/queries.ts`. One statement, four `UNION ALL` branches, so the palette costs one round trip.

```ts
import { sql } from '@/db/client';

export type Hit = {
  kind: 'stock' | 'party' | 'bill' | 'requirement';
  label: string;
  sub: string;
  href: string;
};

/**
 * One query behind Cmd-K. Ranked kind-first — you almost always mean the
 * goods or the party, not a document number that happens to contain the digits.
 */
export async function search(q: string, limit = 8): Promise<Hit[]> {
  const term = q.trim();
  if (!term) return [];
  const like = `%${term}%`;

  const rows = await sql`
    (SELECT 'stock' AS kind, 1 AS ord,
            concat_ws(' · ', spec_sieve(sieve_size), NULLIF(spec_mm(mm_size),'') || 'mm', shape) AS label,
            concat_ws(' · ', colour, clarity, round(balance,2)::text || ' ct') AS sub,
            '/stock/' || lot_no AS href
       FROM lot_balances
      WHERE source <> 'memo_in' AND balance > 0.0005
        AND (sieve_size ILIKE ${like} OR mm_size ILIKE ${like} OR shape ILIKE ${like}
             OR colour ILIKE ${like} OR clarity ILIKE ${like} OR lot_no ILIKE ${like})
      ORDER BY balance DESC LIMIT ${limit})
    UNION ALL
    (SELECT 'party', 2, name, COALESCE(business_name, kind), '/parties/' || id
       FROM parties
      WHERE name ILIKE ${like} OR business_name ILIKE ${like}
      ORDER BY name LIMIT ${limit})
    UNION ALL
    (SELECT 'bill', 3, COALESCE(bill_no, 'unnumbered'),
            party_name || ' · ' || direction, '/accounts/bills/' || bill_key
       FROM bills
      WHERE bill_no ILIKE ${like} OR party_name ILIKE ${like}
      ORDER BY billed_on DESC NULLS LAST LIMIT ${limit})
    UNION ALL
    (SELECT DISTINCT ON (requirement_no) 'requirement', 4, requirement_no,
            party_name || ' · ' || requirement_status, '/sales/' || requirement_no
       FROM requirement_line_status
      WHERE requirement_no ILIKE ${like} OR party_name ILIKE ${like}
      ORDER BY requirement_no DESC LIMIT ${limit})
    ORDER BY ord
    LIMIT ${limit * 2}`;

  return rows.map((r: any) => ({
    kind: r.kind, label: r.label ?? '—', sub: r.sub ?? '', href: encodeURI(r.href),
  }));
}
```

If `SELECT DISTINCT ON` conflicts with the outer `ORDER BY ord` in your Postgres version, wrap that branch in a sub-select. Run the query in isolation first (`psql`, or a scratch `tsx` script) before wiring the UI.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx -r dotenv/config --test tests/palette.test.ts dotenv_config_path=.env.local`
Expected: PASS. If the stock test fails with "no stock hit", the test branch has no owned lot with a balance — insert one the same way `tests/helpers.ts` `makeFixtures` does, and delete it in a `finally`.

- [ ] **Step 5: Write the server action**

Create `features/search/actions.ts`:

```ts
'use server';

import { auth } from '@/lib/auth/server';
import { search, type Hit } from './queries';

export async function searchAction(q: string): Promise<Hit[]> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return [];
  return search(q);
}
```

Signing out must not leave a searchable index behind: the guard is not optional.

- [ ] **Step 6: Write the palette**

Create `components/layout/command-palette.tsx`. Built on the existing `Dialog` and `Input` — no new dependency.

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchAction } from '@/features/search/actions';
import type { Hit } from '@/features/search/queries';

const ACTIONS: Hit[] = [
  { kind: 'stock', label: 'Add diamonds', sub: 'on bill or on memo', href: '/stock?new=1' },
  { kind: 'requirement', label: 'New requirement', sub: 'a customer asked for something', href: '/sales?new=1' },
  { kind: 'party', label: 'New party', sub: 'supplier or client', href: '/parties?new=1' },
];

const KIND_LABEL: Record<Hit['kind'], string> = {
  stock: 'Stock', party: 'Party', bill: 'Bill', requirement: 'Requirement',
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>(ACTIONS);
  const [cursor, setCursor] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 150ms is under the threshold where typing feels laggy and still collapses
  // a burst of keystrokes into one round trip.
  useEffect(() => {
    if (!q.trim()) {
      setHits(ACTIONS);
      setCursor(0);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        setHits(await searchAction(q));
        setCursor(0);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ('');
    router.push(hit.href);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(''); }}>
      <DialogContent className="max-w-lg p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); go(hits[cursor]); }
          }}
          placeholder="Search stock, parties, bills, requirements…"
          className="border-0 border-b bg-transparent text-base focus-visible:ring-0"
        />
        <ul className="max-h-80 overflow-y-auto p-1">
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.href}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(h)}
                className={cn(
                  'flex w-full items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left text-sm',
                  i === cursor && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="font-medium">{h.label}</span>
                <span className="truncate text-xs text-muted-foreground">{h.sub}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {KIND_LABEL[h.kind]}
                </span>
              </button>
            </li>
          ))}
          {!hits.length && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Mount it and advertise the shortcut**

In `app/(app)/layout.tsx`, render `<CommandPalette />` inside the outer `<div className="min-h-screen">`, after `<header>`. The palette owns its own open state and needs no trigger. To make the shortcut discoverable, add this next to the email in the header:

```tsx
<span className="hidden text-xs text-muted-foreground sm:inline">⌘K to search</span>
```

- [ ] **Step 8: Verify by hand**

Run: `npm run dev`, sign in, press Cmd-K. Check: actions listed on an empty query; typing a party name lists it; ArrowDown then Enter navigates; Escape closes.

- [ ] **Step 9: Run the suite**

Run: `npm run typecheck && npm run test`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: command palette — search stock, parties, bills, requirements"
```

---

### Task 8: Entry ergonomics

**Files:**
- Modify: `features/stock/components/add-stock-sheet.tsx`
- Modify: `features/sales/components/requirement-form.tsx`
- Modify: `features/parties/components/party-dialog.tsx`
- Modify: `app/(app)/stock/page.tsx`, `app/(app)/sales/page.tsx`, `app/(app)/parties/page.tsx` (pass `defaultOpen`)
- Create: `lib/use-last-used.ts`

**Interfaces:**
- Consumes: the `?new=1` links produced by the palette (Task 7).
- Produces: `useLastUsed(key: string, fallback: string): [string, (v: string) => void]` from `lib/use-last-used.ts`.

- [ ] **Step 1: Write the last-used hook**

Create `lib/use-last-used.ts`. `localStorage` is read in an effect, never during render — reading it during render breaks hydration.

```ts
'use client';

import { useEffect, useState } from 'react';

/** Remembers the last value typed into a field, per browser. Convenience only —
 *  nothing here is authoritative, and a cleared store just means an empty field. */
export function useLastUsed(key: string, fallback = ''): [string, (v: string) => void] {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(stored);
    } catch { /* private mode, blocked storage: keep the fallback */ }
  }, [key]);

  return [value, (v: string) => {
    setValue(v);
    try { window.localStorage.setItem(key, v); } catch { /* ignore */ }
  }];
}
```

- [ ] **Step 2: Open sheets from a URL param**

Give `AddStockSheet`, `RequirementForm` and `PartyDialog` an optional prop:

```tsx
export function AddStockSheet({ defaultOpen = false, /* …existing props */ }: { defaultOpen?: boolean; /* … */ }) {
  const [open, setOpen] = useState(defaultOpen);
```

In each owning page, read the param and pass it: `<AddStockSheet defaultOpen={sp.new === '1'} … />` on `/stock`, the same on `/sales` for `RequirementForm`, and on `/parties` for `PartyDialog`.

- [ ] **Step 3: Autofocus the first field**

In each of the three components, add `autoFocus` to the first `<Input>` or `<select>` inside the form. Base UI's dialog moves focus to the popup on open; `autoFocus` moves it to the field, which is where typing should start.

- [ ] **Step 4: Add "Save & add another"**

In `AddStockSheet`, the action wrapper currently closes the sheet on success:

```tsx
const res = await addStockAction(prev, fd);
if (res && 'ok' in res) setOpen(false);
```

Replace with a ref-free flag driven by which submit button was pressed. Add a second submit button in `SheetFooter`:

```tsx
<Button type="submit" name="then" value="again" variant="outline" disabled={isPending}>
  Save & add another
</Button>
<Button type="submit" name="then" value="close" disabled={isPending}>Save</Button>
```

and in the wrapper:

```tsx
const res = await addStockAction(prev, fd);
if (res && 'ok' in res && fd.get('then') !== 'again') setOpen(false);
```

`addStockAction` ignores the extra `then` field — it reads named fields explicitly, so no server change is needed. Verify that by reading `features/stock/actions.ts` before assuming it.

When the form stays open, clear the quantity fields but keep supplier, date and spec: the next parcel from the same supplier usually differs only in size and carats. Do this with a `key` bump on the form element (`<form key={submitCount}>`) plus `defaultValue` on the fields being kept.

- [ ] **Step 5: Default the party and the date**

In `AddStockSheet`, replace the supplier `<select>`'s uncontrolled value with `useLastUsed('stock.supplier', '')`. Do the same for the customer field in `RequirementForm` under key `sales.customer`. The date input already defaults to `today`; leave it.

- [ ] **Step 6: Verify by hand**

Run: `npm run dev`. Check: Cmd-K → "Add diamonds" opens `/stock?new=1` with the sheet open and the first field focused; "Save & add another" keeps it open with the supplier still selected; reloading the page later pre-selects that supplier.

- [ ] **Step 7: Run the suite**

Run: `npm run typecheck && npm run test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: faster entry — open from the palette, save and add another, remembered party"
```

---

## Done when

- `npm run typecheck`, `npm run test:pure` and `npm run test` all pass.
- `grep -rn "/memos\|/movements\|jewellery_orders\|getSegments" app features lib scripts tests` returns nothing outside migration 019's comment.
- The header shows exactly: Today · Stock · Sales · Accounts · Masters.
- Cmd-K finds a party, a stock unit, a bill and a requirement, and opens all three entry sheets.
