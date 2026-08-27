# Aurum ERP — Movements Ledger Rebuild (Next.js + Neon)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the localStorage spreadsheet-clone with a Postgres-backed Next.js app where every carat movement and every rupee is an append-only ledger row, so stock balance, memo exposure, COGS and party aging are all derived queries rather than hand-maintained columns.

**Architecture:** Two append-only ledgers and nothing else holds a balance. `movements` is the carat ledger (signed rows against a `lots` parcel); `ledger` is the money ledger (signed rows against a `parties` row). Every balance in the app — vault stock, memo exposure, receivables, payables, aging — is a SQL view or aggregate over those two tables. Mutations go through domain functions in `lib/` that wrap a transaction and are guarded by a database trigger, so no code path can oversell a lot even if a future API route forgets to check.

**Tech Stack:** Next.js 16.3.3 (App Router, TypeScript, React 19), Tailwind v4 + shadcn/ui, Neon Postgres via `@neondatabase/serverless`, Neon Auth (Managed Better Auth) via `@neondatabase/auth`, raw SQL migrations (no ORM), `node --test` + `tsx` for tests, Neon database branching for test isolation.

## Build status (updated 2026-08-27)

Tasks 1–5 and the migrations for Tasks 6 and 11 are **built and verified against the live Neon branch**. What remains starts at Task 6 Step 4.

| Done | Evidence |
|---|---|
| Next.js 16.3.3 scaffolded in repo root, Tailwind v4, shadcn/ui initialised (13 components) | `npx tsc --noEmit` exits 0 |
| Neon Auth (Managed Better Auth) wired: `lib/auth/{server,client}.ts`, `app/api/auth/[...path]/route.ts`, `proxy.ts`, sign-in/sign-up pages | pages render; route protection via `auth.middleware` |
| `db/client.ts` with `sql`, `withTx`, `runSqlFile` | smoke test below |
| Migrations `000`–`004` applied to the live branch | `npm run migrate` → `5 migration(s) applied` |
| 8 tables + `lot_balances` + `party_balances` + both triggers | `information_schema` listing verified |
| Overdraw guard fires | live: `insufficient stock in lot …: balance 10.000, requested 99.000`, rolled back clean |
| `lib/dates.ts`, `lib/normalize.ts` + tests | **12/12 pass**, including sweeps over all 2,001 real workbook rows |
| `scripts/import.ts` + `lib/reconcile.ts` | workbook imported; **11/11 reconciliation checks pass** |

**Corrections made to this plan while building it:**
- Neon Auth is **Managed Better Auth** (`@neondatabase/auth`), not Stack Auth. Stack Auth is the documented legacy path.
- Next.js 16 uses **`proxy.ts`**, not `middleware.ts`.
- `db/client.ts` must read **`DATABASE_URL` only**. Preferring `TEST_DATABASE_URL` when set means a stale placeholder silently captures the real app. Tests swap the variable via `tests/use-test-db.ts` (`--import`), which refuses to run if it is unset, still the placeholder, or equal to `DATABASE_URL`.
- `lot_balances.exposure` must subtract **billed** carats as well as returned ones; billed carats are no longer exposure.
- `memo_line_billings` moved into `001_schema.sql` (the plan created it later, in Task 7).

**Tasks 8, 9 and 10 are also done.** `scripts/import.ts` bulk-loads via `UNNEST`
(one round trip per table, ~32s) rather than the row-at-a-time loop the task
below describes, which would have issued ~8,000 statements. Positive movements
insert before negative ones so the overdraw guard never sees a sale before its
purchase. Reconciliation lives in `lib/reconcile.ts` with two entry points:
`npm run reconcile` (script) and `tests/reconcile.test.ts` (gate).
**All 11 checks pass.**

Five data problems the import surfaced, each handled explicitly rather than
silently:

| Source row | Problem | Handling |
|---|---|---|
| `kaivan_stock` Sr.23 | `Carats 0.43`, `Used 0.46`, `Balance −0.03` — an impossible negative physical balance | `adjust_in` plug of 0.030 ct tagged `ref_type='reconciliation'`, so it is queryable and excluded from source-total checks. Generalised: any lot whose movements net negative gets one. |
| `DH-7` | CZ sale, 107 pcs, `Carats: '-'` — sold by piece, no weight | No lot or movement (they require `carats <> 0`); the ₹6,000 still posts to the ledger. |
| `DH-1`, `DH-271` | ₹1,140 sale and ₹1,980 purchase with a blank counterparty | Posted against an explicit `(Unidentified)` party rather than dropped. |
| `JM-10`, `JM-18` | `Cust Order No` holds the literal text `Adjusted Against Diamonds`; no customer, product or amount | Skipped as annotations, detected by absence of content rather than by matching that string. |
| `JM-29` | A real order (Karan, Screw Bck, ₹1,645, fully paid) with no order number | Order number synthesised; the order and its money are preserved. |

Final counts: **1,993 lots** (1,963 diamond_hisab + 30 kaivan_stock), **3,983
movements**, **7,263 ledger rows**, **35 jewellery orders**, **118 parties**.

Money tolerances are ₹1, not zero: 125 source rows carry more than two decimal
places, and the workbook sums them unrounded while `numeric(14,2)` rounds each
row to paise. Observed drift is ₹0.10 across ₹1.59 crore. Carats reconcile
exactly.

**Tasks 6, 7, 11, 12 and 13 are also done.** The memo lifecycle lives in
`lib/ledger/movements.ts`; every function takes an **optional transaction
context**, so callers can compose operations atomically and the test suite can
run inside a transaction it rolls back. That last part matters: `movements` is
append-only, so rollback is the only way to remove a fixture. The suite
therefore runs safely against the live branch — **20/20 pass, zero residue.**

UI shipped on shadcn/Base UI: `/stock`, `/memos`, `/accounts`, and a real
dashboard. `npm run build` is clean; unauthenticated requests 307 to `/sign-in`.

**Two P&L bugs found and fixed while wiring the dashboard:**

1. `aging_as_of` summed `sale_invoice` and ignored payments, so it aged *gross
   invoiced* rather than *outstanding* — Carpe Diam showed ₹96.9 L against a
   ₹13.8 L receivable. Now nets per `(ref_type, ref_id)`, which is exact because
   the import links each payment to its invoice's reference. Carpe Diam now
   reads ₹7,48,782.
2. COGS was taken from the money ledger, which excludes the 164 sold-from-own-
   stock rows, then from all purchases, which wrongly counted unsold inventory.
   Now: **cost of lots that have actually sold**, split by segment.

Final P&L, which independently reproduces the figure computed from the raw
workbook at the very start of this project (₹22,55,538 / 11.8%):

| Segment | Revenue | Cost | Profit | Margin |
|---|---|---|---|---|
| Diamond trading | ₹1,80,99,078.77 | ₹1,59,20,488.36 | ₹21,78,590.41 | 12.0% |
| Jewellery | ₹10,89,973.14 | ₹10,13,025.91 | ₹76,947.23 | 7.1% |
| **Total** | **₹1,91,89,051.91** | **₹1,69,33,514.27** | **₹22,55,537.64** | **11.8%** |

**Open item — jewellery/diamond cost overlap.** The source `Product Costing`
column bundles ₹2,63,937 of diamonds set into jewellery. Where those stones were
sourced internally (`Purchase Party` = Kaivan Stock, Naice Jewels, A.B.Creation…)
they are also counted in the diamond segment, so combined profit is understated
by up to that amount. The workbook records the same stones on two sheets with no
key linking them; resolving it needs a business decision, not code. The
dashboard states this on screen rather than hiding it.

**Still to do:** inward (vendor) memo UI, the jangad print voucher, payment
recording against ledger balances, and Task 12's REST routes (the UI uses server
actions directly, so those routes are only needed for an external client).

**Superseded below:** Task 6 Step 4 onward — `lib/ledger/movements.ts`, the memo lifecycle, the import script, the reconciliation gate, aging queries, API routes, and the feature UIs.

---

**Spec:** This document is self-contained. It supersedes the earlier "Consignment Memo (Jangad) Lifecycle, Accounts & P&L Suite" plan, which specified features already shipped in `app.js` while leaving the stock↔memo linkage — its actual subject — unimplemented.

---

## Global Constraints

- **Node 22+** (uses `node --test`, `--experimental-strip-types` not required because tests run via `tsx`).
- **No ORM.** Schema lives in `db/migrations/*.sql` as reviewable SQL. The integrity rules here are CHECK constraints, a trigger, and views; those are the product, and an ORM DSL would obscure them. If query ergonomics later hurt, add Drizzle over the existing schema — do not let it own the schema.
- **Money and quantity are `numeric`, never `float`.** `numeric(14,2)` for amounts, `numeric(14,4)` for rates, `numeric(10,3)` for carats. Postgres `numeric` is exact; the source data has values like `4190.070922` that must not accumulate binary rounding error.
- **`movements` and `ledger` are append-only.** Corrections are new reversing rows, never `UPDATE`/`DELETE`. A `REVOKE UPDATE, DELETE` is applied in Task 3.
- **Balance semantics, fixed for the whole project:** a lot's `balance` is **carats physically in the vault**. Issuing on an outward memo *decreases* it (goods left the building). Ownership-but-not-possession is reported separately as `exposure` from open memo lines. Never add a second definition.
- **All dates stored as `date`/`timestamptz`, never text.** The source has 5 distinct non-ISO formats plus the literal string `Pending`; see Task 4.
- **Currency display:** `en-IN` locale, `₹` prefix, 2 decimals. Carats display 3 decimals.
- **Reconciliation is a gate, not a report.** Task 9's assertions must pass against the real 2,031 source rows before any UI task starts.

---

## Source Data — measured, not assumed

All figures below are computed from `ref/initial_data.json` and are the reconciliation targets for Task 9.

| Sheet | Rows | Measured totals |
|---|---|---|
| `diamond_hisab` | 1964 | Pur.Amt `15,920,488.26` · Paid `15,219,360.25` · Bal `701,128.02` · Sale `18,099,078.81` · Paid `16,906,534.14` · Bal `1,192,544.67` · Carats `1416.168` |
| `kaivan_stock` | 30 | Carats `48.810` · Used `32.560` · Balance `16.250` |
| `jewellery_master` | 37 | Client Total `1,089,973.15` · Client Bal `183,604.30` · Supplier Bal `58,594.03` |

Structural facts that drive the migration design:

- **1955 of 1964** `diamond_hisab` rows carry a purchase *and* a sale on the same row. 1964 have a sale; 1955 have a purchase. The 9 rows with no purchase are sale-only.
- **164 rows have `Pur. Party = 'Kaivan Stock'`** — sold out of own inventory. They **cannot be matched** to the 30 `kaivan_stock` lots: 0 of 164 match on `(Sieve Size, Shape)`, and their carats (`39.55`) exceed total `kaivan_stock` `Stock Used` (`32.56`). Task 7 therefore creates a self-lot per row rather than inventing a link. This is a deliberate, documented lossy point.
- **Arithmetic is sound**: 0 rows where `Amt − Paid ≠ Bal`, on both purchase and sale sides. 7 rows where `Carats × Pur.Rate ≠ Pur.Amt`, 1 on the sale side, 9 where `Sale − Pur ≠ Profit Loss`. These 17 are imported at their stated `Amt` (the amount is authoritative, the rate is derived).
- **116 distinct party strings**, with **7 case/spacing/punctuation collision groups**: `A B Creation`/`A.B.Creation`, `Babeshwar`/`BABESHWAR`, `H.R.IMPEX`/`H R Impex`, `ETHEREAL GREEN`/`Ethereal Green`, `KIA GEMS`/`KIA Gems`, `Ecobrilliance`/`Eco Brilliance`, `KIRA DIAM`/`Kira Diam`.
- **Non-ISO dates**, complete enumeration across all date columns: `DD-Mon-YY(YY)` ×201, `DD/MM/YYYY` ×14, `DD-MM-YYYY` ×5, literal `Pending` ×308, literal `-` ×2, and one `Due Date` holding `LOC-26-27-00164`. Month tokens outside the standard 3-letter set: **`Sept`, `sept`, `Jn`** (typo for `Jun`).
- **One `Pur. Date` equals `2026-08-27`** — a live `=TODAY()` that leaked into the export. Import must not treat it as meaningful.
- **509 distinct sieve sizes, 409 MM sizes, 29 clarity, 22 colour values.** Free-text, not normalized. Task 5 canonicalizes party names only; sieve/clarity/colour are imported verbatim into `lots` and left for a later curation pass — normalizing 509 sieve strings is a data-entry project, not a code project, and blocking on it would stall the build.

---

## File Structure

Feature-sliced. `lib/ledger/` is the shared domain kernel — movements and money
are used by stock, memos, accounts and the dashboard alike, so they do not live
inside any one feature. Everything a feature owns (its queries, server actions
and components) sits in its own folder, so a feature can be read, changed or
deleted without touching its neighbours.

```
app/
  (auth)/                        public: layout, sign-in/page.tsx, sign-up/page.tsx
  (app)/                         protected: layout.tsx (session gate + nav), page.tsx
    stock/page.tsx  memos/page.tsx  accounts/page.tsx      [Task 13]
  api/
    auth/[...path]/route.ts      Neon Auth proxy                          [done]
    stock|memos|accounts/route.ts                                      [Task 12]
proxy.ts                         route protection (Next 16 name)          [done]

components/
  ui/                            shadcn primitives (13 installed)         [done]
  layout/main-nav.tsx            nav; add an entry per feature page       [done]

features/
  auth/       actions.ts  components/credentials-form.tsx                 [done]
  dashboard/  queries.ts  components/                                  [Task 13]
  stock/      queries.ts  components/                                  [Task 13]
  memos/      queries.ts  actions.ts  components/                   [Tasks 7,13]
  accounts/   queries.ts  components/                                 [Task 11,13]

lib/
  auth/       server.ts  client.ts                                        [done]
  ledger/     movements.ts  money.ts   <- domain kernel              [Tasks 6,7,11]
  dates.ts  normalize.ts  format.ts  utils.ts                             [done]

db/
  client.ts                      sql, withTx, runSqlFile                  [done]
  migrations/000..004.sql        applied                                  [done]

scripts/    migrate.ts [done]   import.ts [Tasks 8,9]
tests/      use-test-db.ts, dates, normalize [done]; the rest per task
ref/        the original workbook, initial_data.json, and the retired prototype
```

**Conventions.** A feature's `queries.ts` holds read-only SQL returning plain
objects; `actions.ts` holds `'use server'` mutations that call `lib/ledger/`;
`components/` holds that feature's UI. Pages in `app/` compose features and hold
no SQL of their own. Adding a page means adding one entry to `NAV_ITEMS` in
`components/layout/main-nav.tsx`.

**Note on task numbering below:** the plan was written before the scaffold
existed, so Task 6 Step 3 creates `db/migrations/003_guard.sql` and Task 7 Step 4
creates the billings table — both are already applied. Task 11 Step 3 creates
`005_aging.sql`, which shipped as `004_aging.sql`. Skip those steps; the code
steps around them still stand. Where a task says `lib/movements.ts` or
`lib/ledger.ts`, write `lib/ledger/movements.ts` and `lib/ledger/money.ts`.

---

## Schema (reference — implemented in Task 2)

```
parties      id, name (unique, canonical), kind, created_at
lots         id, lot_no, party_id, stone_type, shape, sieve_size, mm_size,
             clarity, colour, cost_rate, source, opened_on, notes
movements    id, lot_id, kind, carats (signed), rate, amount,
             memo_line_id, ref_type, ref_id, moved_on, notes
memos        id, memo_no (unique), direction, party_id, issued_on, due_on, status, notes
memo_lines   id, memo_id, lot_id, carats, rate, status
ledger       id, party_id, kind, amount (signed), dated_on, ref_type, ref_id, notes
jewellery_orders  (37 rows, ported near-verbatim; links to movements via consumed_jewellery)
```

Movement kinds and their sign, fixed:

| kind | sign | meaning |
|---|---|---|
| `purchase` | `+` | bought outright, entered vault |
| `memo_in_receipt` | `+` | vendor consignment received |
| `memo_out_return` | `+` | client returned goods |
| `adjust_in` | `+` | correction / found stock |
| `sale` | `−` | sold from vault directly |
| `memo_out_issue` | `−` | issued to client on approval |
| `memo_in_return` | `−` | returned to vendor |
| `consumed_jewellery` | `−` | set into a jewellery order |
| `adjust_out` | `−` | correction / loss |

**Billing an outward memo line inserts no movement.** The carats already left the vault at `memo_out_issue`. Billing posts a `sale_invoice` row to `ledger` and flips `memo_lines.status` to `billed`. Getting this wrong double-counts every sale; it is asserted in Task 10.

---
## Task 1: Scaffold, Neon connection, migration runner

**Files:**
- Create: `package.json`, `.env.local`, `db/client.ts`, `scripts/migrate.ts`, `db/migrations/000_init.sql`
- Test: `tests/connection.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `sql` (Neon tagged-template query fn), `withTx<T>(fn: (tx) => Promise<T>): Promise<T>` from `db/client.ts`. Every later task imports these two.

- [ ] **Step 1: Scaffold the app**

```bash
cd /Users/cdkaifk/Downloads/kd
npx create-next-app@latest . --typescript --app --no-src-dir --eslint --tailwind --use-npm
npm i @neondatabase/serverless
npm i -D tsx dotenv
```

When `create-next-app` warns the directory is not empty, accept — the existing `app.js`, `index.html`, `data.js`, `styles.css` stay untouched as reference until Task 12.

- [ ] **Step 2: Create the Neon project and capture the connection string**

In the Neon console create a project named `aurum-erp`. Copy the pooled connection string into `.env.local`, and create a second branch named `test` off `main` for the test suite:

```
DATABASE_URL=postgresql://...@ep-....neon.tech/neondb?sslmode=require
TEST_DATABASE_URL=postgresql://...@ep-...-test.neon.tech/neondb?sslmode=require
```

Add `.env.local` to `.gitignore` (create-next-app already does this — verify with `grep '.env' .gitignore`).

- [ ] **Step 3: Write `db/client.ts`**

```typescript
import { neon, neonConfig, Pool } from '@neondatabase/serverless';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export const sql = neon(url);

/** Runs fn inside a single transaction. Every mutation in lib/ uses this. */
export async function withTx<T>(fn: (tx: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client as unknown as Pool);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
```

- [ ] **Step 4: Write `scripts/migrate.ts`**

```typescript
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from '../db/client';

const dir = join(process.cwd(), 'db/migrations');

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const done = new Set(
    (await sql`SELECT name FROM _migrations`).map((r: any) => r.name)
  );
  for (const name of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    console.log('applying', name);
    await sql.transaction([sql(readFileSync(join(dir, name), 'utf8'))]);
    await sql`INSERT INTO _migrations (name) VALUES (${name})`;
  }
  console.log('migrations up to date');
}
main();
```

Note: `sql.transaction` with a raw string runs the whole file as one statement batch. If the Neon driver rejects multi-statement strings, fall back to `new Pool()` + `client.query(fileContents)`, which does accept them.

- [ ] **Step 5: Create `db/migrations/000_init.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

- [ ] **Step 6: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "migrate": "tsx -r dotenv/config scripts/migrate.ts dotenv_config_path=.env.local",
    "import": "tsx -r dotenv/config scripts/import.ts dotenv_config_path=.env.local",
    "test": "TEST_DATABASE_URL=$TEST_DATABASE_URL tsx --test tests/*.test.ts"
  }
}
```

- [ ] **Step 7: Write the connection test**

```typescript
// tests/connection.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';

test('connects to Neon and pgcrypto is available', async () => {
  const rows = await sql`SELECT gen_random_uuid() AS id`;
  assert.match(rows[0].id, /^[0-9a-f-]{36}$/);
});
```

- [ ] **Step 8: Run migration then test**

Run: `npm run migrate && npm test`
Expected: `migrations up to date`, then `1 pass`.

- [ ] **Step 9: Commit**

```bash
git init && git add -A
git commit -m "feat: scaffold Next.js app with Neon client and SQL migration runner"
```

---

## Task 2: Core schema

**Files:**
- Create: `db/migrations/001_schema.sql`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: `sql` from `db/client.ts`.
- Produces: tables `parties`, `lots`, `memos`, `memo_lines`, `movements`, `ledger`, `jewellery_orders`. Column names below are relied on verbatim by every later task.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/schema.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';

const expected = ['jewellery_orders','ledger','lots','memo_lines','memos','movements','parties'];

test('all core tables exist', async () => {
  const rows = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${expected})
    ORDER BY table_name`;
  assert.deepEqual(rows.map((r: any) => r.table_name), expected);
});

test('movement kind is constrained to the nine known kinds', async () => {
  await assert.rejects(
    () => sql`INSERT INTO movements (lot_id, kind, carats, moved_on)
              VALUES (gen_random_uuid(), 'teleported', 1, '2024-04-01')`,
    /violates|constraint/i
  );
});

test('carats cannot be zero', async () => {
  const [lot] = await sql`
    INSERT INTO lots (lot_no, stone_type) VALUES ('ZERO-TEST', 'Lab Grown') RETURNING id`;
  await assert.rejects(
    () => sql`INSERT INTO movements (lot_id, kind, carats, moved_on)
              VALUES (${lot.id}, 'purchase', 0, '2024-04-01')`,
    /constraint/i
  );
  await sql`DELETE FROM lots WHERE lot_no = 'ZERO-TEST'`;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/schema.test.ts`
Expected: FAIL — `relation "movements" does not exist`.

- [ ] **Step 3: Write `db/migrations/001_schema.sql`**

```sql
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

-- One row per lot on a memo. Partial returns append movements against the
-- line; the line closes only when settled_carats = carats.
CREATE TABLE memo_lines (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id  uuid NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  lot_id   uuid NOT NULL REFERENCES lots(id),
  carats   numeric(10,3) NOT NULL CHECK (carats > 0),
  rate     numeric(14,4) NOT NULL CHECK (rate >= 0),
  status   text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled'))
);

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
  -- sign must agree with kind; this is the invariant the whole app rests on
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
  -- positive = they owe us, negative = we owe them
  CONSTRAINT ledger_sign CHECK (
    (kind IN ('sale_invoice','payment_out') AND amount > 0)
    OR
    (kind IN ('purchase_invoice','payment_in') AND amount < 0)
    OR kind = 'adjustment'
  )
);
CREATE INDEX ledger_party_idx ON ledger (party_id);
CREATE INDEX ledger_date_idx ON ledger (dated_on);

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
```

- [ ] **Step 4: Apply and run the test**

Run: `npm run migrate && npm test -- tests/schema.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/001_schema.sql tests/schema.test.ts
git commit -m "feat: core schema with signed movement and ledger constraints"
```

---

## Task 3: Balance views and the append-only lock

**Files:**
- Create: `db/migrations/002_views.sql`
- Test: `tests/views.test.ts`

**Interfaces:**
- Consumes: tables from Task 2.
- Produces: views `lot_balances` (columns `lot_id, lot_no, stone_type, shape, sieve_size, mm_size, cost_rate, party_name, balance, exposure, in_vault`) and `party_balances` (`party_id, party_name, receivable, payable, net`). Tasks 6, 10, 11 and every UI page read these.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/views.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';

let lotId: string;

before(async () => {
  await sql`DELETE FROM movements WHERE ref_id = 'VIEWTEST'`;
  await sql`DELETE FROM lots WHERE lot_no = 'VIEW-1'`;
  const [lot] = await sql`INSERT INTO lots (lot_no, stone_type, cost_rate)
                          VALUES ('VIEW-1', 'Lab Grown', 4000) RETURNING id`;
  lotId = lot.id;
  await sql`INSERT INTO movements (lot_id, kind, carats, moved_on, ref_id)
            VALUES (${lotId}, 'purchase', 10.000, '2024-04-01', 'VIEWTEST'),
                   (${lotId}, 'sale', -2.500, '2024-04-05', 'VIEWTEST')`;
});

test('lot_balances sums signed movements', async () => {
  const [row] = await sql`SELECT balance FROM lot_balances WHERE lot_id = ${lotId}`;
  assert.equal(Number(row.balance), 7.5);
});

test('movements table rejects UPDATE (append-only)', async () => {
  await assert.rejects(
    () => sql`UPDATE movements SET carats = 999 WHERE lot_id = ${lotId}`,
    /permission denied|read-only|cannot/i
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/views.test.ts`
Expected: FAIL — `relation "lot_balances" does not exist`.

- [ ] **Step 3: Write `db/migrations/002_views.sql`**

```sql
-- balance = carats physically in the vault.
-- exposure = carats sitting with a client on an open outward memo line.
CREATE VIEW lot_balances AS
SELECT
  l.id                                   AS lot_id,
  l.lot_no,
  l.stone_type, l.shape, l.sieve_size, l.mm_size,
  l.cost_rate,
  p.name                                 AS party_name,
  COALESCE(SUM(m.carats), 0)             AS balance,
  COALESCE((
    SELECT SUM(ml.carats - COALESCE((
              SELECT SUM(ABS(mv.carats)) FROM movements mv
              WHERE mv.memo_line_id = ml.id AND mv.kind = 'memo_out_return'), 0))
    FROM memo_lines ml
    JOIN memos mo ON mo.id = ml.memo_id
    WHERE ml.lot_id = l.id AND ml.status = 'open' AND mo.direction = 'out'
  ), 0)                                  AS exposure,
  COALESCE(SUM(m.carats), 0)             AS in_vault
FROM lots l
LEFT JOIN parties p ON p.id = l.party_id
LEFT JOIN movements m ON m.lot_id = l.id
GROUP BY l.id, p.name;

CREATE VIEW party_balances AS
SELECT
  p.id   AS party_id,
  p.name AS party_name,
  -- classify by KIND, not by sign: payment_out is positive but is not a
  -- receivable, and payment_in is negative but is not a payable. A party that
  -- is both supplier and client would otherwise show inflated figures on both.
  COALESCE(SUM(g.amount) FILTER (WHERE g.kind IN ('sale_invoice','payment_in')), 0)      AS receivable,
  COALESCE(-SUM(g.amount) FILTER (WHERE g.kind IN ('purchase_invoice','payment_out')), 0) AS payable,
  COALESCE(SUM(g.amount), 0)                                      AS net
FROM parties p
LEFT JOIN ledger g ON g.party_id = p.id
GROUP BY p.id, p.name;

-- Append-only: corrections are reversing rows, never edits.
CREATE RULE movements_no_update AS ON UPDATE TO movements DO INSTEAD NOTHING;
CREATE RULE movements_no_delete AS ON DELETE TO movements DO INSTEAD NOTHING;
```

Note on the rules: `DO INSTEAD NOTHING` silently discards the write rather than raising. If the test above requires a thrown error, replace both rules with a `BEFORE UPDATE OR DELETE` trigger that calls `RAISE EXCEPTION 'movements is append-only'`, and assert on that message instead. Prefer the trigger — a silent no-op is the kind of thing that costs an evening at 3am.

- [ ] **Step 4: Apply and run tests**

Run: `npm run migrate && npm test -- tests/views.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/002_views.sql tests/views.test.ts
git commit -m "feat: lot_balances and party_balances views, append-only movements"
```

---

## Task 4: Loose date parser

**Files:**
- Create: `lib/dates.ts`
- Test: `tests/dates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseLooseDate(input: unknown): string | null` — returns an ISO `YYYY-MM-DD` string or `null`. Task 6, 7 and 8 call it for every date column.

- [ ] **Step 1: Write the failing test**

Every case below is a real value measured in `ref/initial_data.json`.

```typescript
// tests/dates.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLooseDate } from '../lib/dates';

test('passes ISO through', () => {
  assert.equal(parseLooseDate('2024-06-28'), '2024-06-28');
});

test('parses DD-Mon-YY with the non-standard Sept token', () => {
  assert.equal(parseLooseDate('29-Sept-25'), '2025-09-29');
  assert.equal(parseLooseDate('24-sept-24'), '2024-09-24');
  assert.equal(parseLooseDate('25-Sept-2024'), '2024-09-25');
});

test('parses the Jn typo as June', () => {
  assert.equal(parseLooseDate('29-Jn-2025'), '2025-06-29');
});

test('parses DD/MM/YYYY and DD-MM-YYYY as day-first', () => {
  assert.equal(parseLooseDate('25/09/2024'), '2024-09-25');
  assert.equal(parseLooseDate('31-08-2024'), '2024-08-31');
});

test('returns null for sentinels and junk', () => {
  for (const v of ['Pending', '-', '', ' ', null, undefined, 'LOC-26-27-00164']) {
    assert.equal(parseLooseDate(v), null, `expected null for ${JSON.stringify(v)}`);
  }
});

test('rejects impossible dates rather than rolling them over', () => {
  assert.equal(parseLooseDate('31-Feb-24'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/dates.test.ts`
Expected: FAIL — `Cannot find module '../lib/dates'`.

- [ ] **Step 3: Write `lib/dates.ts`**

```typescript
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  sept: 9,  // source uses "Sept"/"sept" (201 rows across date columns)
  jn: 6,    // source typo for "Jun" (7 rows)
};

const iso = (y: number, m: number, d: number): string | null => {
  // reject rollovers: new Date(2024,1,31) silently becomes Mar 2
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const fullYear = (yy: number) => (yy < 100 ? 2000 + yy : yy);

/** Parses the five date formats present in the source workbook. Returns
 *  ISO YYYY-MM-DD, or null for blanks and sentinels like "Pending" / "-". */
export function parseLooseDate(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s || s === '-' || s.toLowerCase() === 'pending') return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    return mon ? iso(fullYear(+m[3]), mon, +m[1]) : null;
  }

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]); // day-first: Indian convention

  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/dates.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Sweep the real file to prove no format was missed**

```bash
node -e "
const {parseLooseDate}=require('tsx/cjs').require('./lib/dates','.');
const d=require('./initial_data.json');
const cols=['Pur. Date','Order Date','Due Date','Payment Date','Diamond Delivery Date','Payment Date_1','Date','Purchase Date','Amt Rec Date'];
const bad=new Map();
for(const r of [...d.diamond_hisab,...d.jewellery_master])
  for(const c of cols){
    if(!(c in r)) continue;
    const v=r[c]; if(v===null||v===undefined||String(v).trim()==='') continue;
    if(parseLooseDate(v)===null && !['Pending','-'].includes(String(v).trim()))
      bad.set(String(v),(bad.get(String(v))||0)+1);
  }
console.log('unparsed values:',[...bad.entries()]);
"
```

Expected: `unparsed values: [ [ 'LOC-26-27-00164', 1 ] ]` — the single `Due Date` cell holding a bill number. Nothing else may appear. If anything else does, add the format to `parseLooseDate` and its test before continuing.

- [ ] **Step 6: Commit**

```bash
git add lib/dates.ts tests/dates.test.ts
git commit -m "feat: loose date parser covering all five source formats"
```

---

## Task 5: Party name normalizer

**Files:**
- Create: `lib/normalize.ts`
- Test: `tests/normalize.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `canonicalPartyName(raw: unknown): string | null`. Tasks 6, 7, 8 route every party string through it before `INSERT ... ON CONFLICT (name)`.

- [ ] **Step 1: Write the failing test**

The seven collision groups below are the ones measured in the source.

```typescript
// tests/normalize.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPartyName } from '../lib/normalize';

test('collapses the seven real collision groups to one name each', () => {
  const groups = [
    ['A B Creation', 'A.B.Creation'],
    ['Babeshwar', 'BABESHWAR'],
    ['H.R.IMPEX', 'H R Impex'],
    ['ETHEREAL GREEN', 'Ethereal Green'],
    ['KIA GEMS', 'KIA Gems'],
    ['Ecobrilliance', 'Eco Brilliance'],
    ['KIRA DIAM', 'Kira Diam'],
  ];
  for (const g of groups) {
    const canon = g.map(canonicalPartyName);
    assert.equal(new Set(canon).size, 1, `${g.join(' / ')} did not collapse: ${canon}`);
  }
});

test('trims trailing spaces seen in the source', () => {
  assert.equal(canonicalPartyName('Kaivan '), canonicalPartyName('Kaivan'));
});

test('returns null for blanks and placeholders', () => {
  for (const v of [null, undefined, '', '  ', '-', 'None']) {
    assert.equal(canonicalPartyName(v), null);
  }
});

test('does not merge genuinely different parties', () => {
  assert.notEqual(canonicalPartyName('Naice Gems LLP'), canonicalPartyName('Naice Jewels'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/normalize.test.ts`
Expected: FAIL — `Cannot find module '../lib/normalize'`.

- [ ] **Step 3: Write `lib/normalize.ts`**

```typescript
/** Collapse key: case, internal spacing and punctuation are not identity. */
const key = (s: string) => s.toLowerCase().replace(/[.\s]+/g, '');

/** Display form chosen per collapse key: Title Case, single-spaced.
 *  Deliberately mechanical — a curated alias table is a data-entry task,
 *  not a code task, and can be added later as a lookup in front of this. */
export function canonicalPartyName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s || s === '-' || s.toLowerCase() === 'none') return null;

  const acronyms = new Set(['llp', 'kia', 'hr', 'ab', 'trp', 'sm']);
  return s
    .split(' ')
    .map(w => (acronyms.has(key(w)) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

export { key as partyKey };
```

Note: `canonicalPartyName` alone will not collapse `A B Creation` vs `A.B.Creation` (different word counts). The import in Task 6 therefore groups by `partyKey(raw)` and inserts one party per key, using the *longest* raw spelling as the display name. The test above asserts the collapse; make it pass by having `canonicalPartyName` compute the display form from the collapse key, or by exporting a `resolveParties(rawNames: string[]): Map<string,string>` helper. Implement whichever way makes the test green, then keep it — but the grouping must be by `partyKey`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/normalize.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify against the real distinct set**

```bash
npx tsx -e "
import {partyKey} from './lib/normalize';
const d=require('./initial_data.json');
const m=new Map<string,Set<string>>();
for(const r of d.diamond_hisab) for(const c of ['Pur. Party','Party Name']){
  const v=String(r[c]??'').trim(); if(!v||v==='None'||v==='-') continue;
  const k=partyKey(v); if(!m.has(k)) m.set(k,new Set()); m.get(k)!.add(v);
}
console.log('distinct raw:', [...m.values()].reduce((n,s)=>n+s.size,0));
console.log('after collapse:', m.size);
console.log('groups collapsed:', [...m.values()].filter(s=>s.size>1).map(s=>[...s]));
"
```

Expected: `distinct raw: 116`, `after collapse: 109`, and exactly the 7 groups listed in Step 1.

- [ ] **Step 6: Commit**

```bash
git add lib/normalize.ts tests/normalize.test.ts
git commit -m "feat: party name canonicalization collapsing 116 raw names to 109"
```

---
## Task 6: Overdraw guard and basic movement recording

This is the fix for the live data-integrity hole in `app.js`: today a sales memo
can issue 100 ct from a lot holding 5 ct, because `saveMemoOutward` (`app.js:1615`)
writes form fields to an array and never consults stock.

**Files:**
- Create: `db/migrations/003_guard.sql`, `lib/movements.ts`
- Test: `tests/movements.test.ts`

**Interfaces:**
- Consumes: `sql`, `withTx` from `db/client.ts`; views from Task 3.
- Produces:
  - `lotBalance(lotId: string): Promise<number>`
  - `recordPurchase(a: { lotId: string; carats: number; rate: number; on: string; ref?: string }): Promise<string>` → movement id
  - `recordSale(a: { lotId: string; carats: number; rate: number; on: string; ref?: string }): Promise<string>`
  - `OverdrawError` (exported class, `.message` matches `/insufficient/i`)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/movements.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';
import { recordPurchase, recordSale, lotBalance } from '../lib/movements';

let lotId: string;

before(async () => {
  await sql`DELETE FROM movements WHERE ref_id LIKE 'MVTEST%'`;
  await sql`DELETE FROM lots WHERE lot_no = 'MV-1'`;
  const [l] = await sql`INSERT INTO lots (lot_no, stone_type, cost_rate)
                        VALUES ('MV-1','Lab Grown',4000) RETURNING id`;
  lotId = l.id;
});

test('purchase then sale leaves the correct balance', async () => {
  await recordPurchase({ lotId, carats: 10, rate: 4000, on: '2024-04-01', ref: 'MVTEST1' });
  await recordSale({ lotId, carats: 2.5, rate: 4800, on: '2024-04-05', ref: 'MVTEST2' });
  assert.equal(await lotBalance(lotId), 7.5);
});

test('selling more than the lot holds is refused', async () => {
  await assert.rejects(
    () => recordSale({ lotId, carats: 999, rate: 4800, on: '2024-04-06', ref: 'MVTEST3' }),
    /insufficient/i
  );
});

test('a refused sale leaves the balance untouched', async () => {
  assert.equal(await lotBalance(lotId), 7.5);
});

test('amount is stored as carats x rate', async () => {
  const [row] = await sql`SELECT amount FROM movements WHERE ref_id = 'MVTEST2'`;
  assert.equal(Number(row.amount), 12000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/movements.test.ts`
Expected: FAIL — `Cannot find module '../lib/movements'`.

- [ ] **Step 3: Write `db/migrations/003_guard.sql`**

The guard lives in the database, not in application code, so that a future API
route or a manual `psql` session cannot bypass it.

```sql
CREATE OR REPLACE FUNCTION check_lot_not_overdrawn() RETURNS trigger AS $$
DECLARE
  bal numeric(10,3);
BEGIN
  IF NEW.carats < 0 THEN
    SELECT COALESCE(SUM(carats), 0) INTO bal FROM movements WHERE lot_id = NEW.lot_id;
    IF bal + NEW.carats < -0.0005 THEN
      RAISE EXCEPTION 'insufficient stock in lot %: balance %, requested %',
        NEW.lot_id, bal, ABS(NEW.carats)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER movements_overdraw_guard
  BEFORE INSERT ON movements
  FOR EACH ROW EXECUTE FUNCTION check_lot_not_overdrawn();

-- Replaces the silent DO INSTEAD NOTHING rules from 002 with a loud failure.
DROP RULE IF EXISTS movements_no_update ON movements;
DROP RULE IF EXISTS movements_no_delete ON movements;

CREATE OR REPLACE FUNCTION movements_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'movements is append-only; post a reversing row instead'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER movements_no_mutate
  BEFORE UPDATE OR DELETE ON movements
  FOR EACH ROW EXECUTE FUNCTION movements_append_only();
```

The `-0.0005` tolerance matches the `numeric(10,3)` scale: it permits exact
depletion to zero without letting a real overdraw through.

- [ ] **Step 4: Write `lib/movements.ts`**

```typescript
import { sql } from '../db/client';

export class OverdrawError extends Error {}

export async function lotBalance(lotId: string): Promise<number> {
  const [row] = await sql`SELECT balance FROM lot_balances WHERE lot_id = ${lotId}`;
  return row ? Number(row.balance) : 0;
}

type Entry = {
  lotId: string;
  carats: number;      // always positive; sign is applied per kind
  rate: number;
  on: string;          // ISO date
  ref?: string;
  memoLineId?: string;
  notes?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

async function insert(kind: string, sign: 1 | -1, e: Entry): Promise<string> {
  const carats = sign * Math.abs(e.carats);
  try {
    const [row] = await sql`
      INSERT INTO movements (lot_id, kind, carats, rate, amount, memo_line_id, ref_id, moved_on, notes)
      VALUES (${e.lotId}, ${kind}, ${carats}, ${e.rate},
              ${round2(Math.abs(e.carats) * e.rate)}, ${e.memoLineId ?? null},
              ${e.ref ?? null}, ${e.on}, ${e.notes ?? null})
      RETURNING id`;
    return row.id;
  } catch (err: any) {
    if (/insufficient stock/.test(err?.message ?? '')) throw new OverdrawError(err.message);
    throw err;
  }
}

export const recordPurchase = (e: Entry) => insert('purchase', 1, e);
export const recordSale = (e: Entry) => insert('sale', -1, e);
export const recordMemoInReceipt = (e: Entry) => insert('memo_in_receipt', 1, e);
export const recordMemoInReturn = (e: Entry) => insert('memo_in_return', -1, e);
export const recordConsumedForJewellery = (e: Entry) => insert('consumed_jewellery', -1, e);
export const recordOpening = (e: Entry) => insert('adjust_in', 1, e);
export { insert as insertMovement };
```

- [ ] **Step 5: Apply migration and run tests**

Run: `npm run migrate && npm test -- tests/movements.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Re-run the Task 3 view test to confirm the append-only change**

Run: `npm test -- tests/views.test.ts`
Expected: PASS — the assertion `/permission denied|read-only|cannot/i` will now
fail against the new message `movements is append-only`. Update that regex in
`tests/views.test.ts` to `/append-only/i` and re-run. Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/003_guard.sql lib/movements.ts tests/movements.test.ts tests/views.test.ts
git commit -m "feat: database-level overdraw guard and append-only movements"
```

---

## Task 7: Memo lifecycle — issue, partial return, bill

The feature the previous plan named and did not build. Note especially that
**a memo can be split any number of times**: the old `billedCarats` +
`returnedCarats` scalar pair on the memo object permitted exactly one split
and rejected the second. Here each settlement is an appended movement.

**Files:**
- Modify: `lib/movements.ts`
- Test: `tests/memos.test.ts`

**Interfaces:**
- Consumes: everything from Task 6.
- Produces:
  - `issueOutwardMemo(a: { memoNo: string; partyId: string; issuedOn: string; dueOn: string | null; lines: Array<{ lotId: string; carats: number; rate: number }> }): Promise<string>` → memo id
  - `returnFromMemo(a: { memoLineId: string; carats: number; on: string }): Promise<void>`
  - `billMemoLine(a: { memoLineId: string; carats: number; on: string; invoiceNo: string }): Promise<void>`
  - `memoLineOutstanding(memoLineId: string): Promise<number>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/memos.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';
import { recordPurchase, lotBalance } from '../lib/movements';
import { issueOutwardMemo, returnFromMemo, billMemoLine, memoLineOutstanding } from '../lib/movements';

let lotId: string, partyId: string;

before(async () => {
  await sql`DELETE FROM movements WHERE ref_id LIKE 'MEMOTEST%'`;
  await sql`DELETE FROM memos WHERE memo_no LIKE 'MEMO-T%'`;
  await sql`DELETE FROM lots WHERE lot_no = 'MEMO-LOT'`;
  const [p] = await sql`INSERT INTO parties (name) VALUES ('Memo Test Client')
                        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
  partyId = p.id;
  const [l] = await sql`INSERT INTO lots (lot_no, stone_type, cost_rate)
                        VALUES ('MEMO-LOT','Lab Grown',4000) RETURNING id`;
  lotId = l.id;
  await recordPurchase({ lotId, carats: 10, rate: 4000, on: '2024-04-01', ref: 'MEMOTEST0' });
});

test('issuing a memo removes carats from the vault', async () => {
  await issueOutwardMemo({
    memoNo: 'MEMO-T1', partyId, issuedOn: '2024-04-10', dueOn: '2024-04-17',
    lines: [{ lotId, carats: 4, rate: 4800 }],
  });
  assert.equal(await lotBalance(lotId), 6);
});

test('exposure appears on the lot while the memo is open', async () => {
  const [row] = await sql`SELECT exposure FROM lot_balances WHERE lot_id = ${lotId}`;
  assert.equal(Number(row.exposure), 4);
});

test('cannot issue more than the vault holds', async () => {
  await assert.rejects(
    () => issueOutwardMemo({
      memoNo: 'MEMO-T2', partyId, issuedOn: '2024-04-10', dueOn: null,
      lines: [{ lotId, carats: 99, rate: 4800 }],
    }),
    /insufficient/i
  );
});

test('a refused issue rolls back the memo entirely', async () => {
  const rows = await sql`SELECT 1 FROM memos WHERE memo_no = 'MEMO-T2'`;
  assert.equal(rows.length, 0, 'memo row must not survive a failed line insert');
  assert.equal(await lotBalance(lotId), 6);
});

test('a memo line can be settled across MULTIPLE partial events', async () => {
  const [line] = await sql`
    SELECT ml.id FROM memo_lines ml JOIN memos m ON m.id = ml.memo_id
    WHERE m.memo_no = 'MEMO-T1'`;

  await returnFromMemo({ memoLineId: line.id, carats: 1, on: '2024-04-12' });
  assert.equal(await memoLineOutstanding(line.id), 3);
  assert.equal(await lotBalance(lotId), 7);

  await billMemoLine({ memoLineId: line.id, carats: 1, on: '2024-04-15', invoiceNo: 'INV-1' });
  assert.equal(await memoLineOutstanding(line.id), 2);
  assert.equal(await lotBalance(lotId), 7, 'billing must NOT move carats again');

  await returnFromMemo({ memoLineId: line.id, carats: 2, on: '2024-04-20' });
  assert.equal(await memoLineOutstanding(line.id), 0);
  assert.equal(await lotBalance(lotId), 9);
});

test('settling a fully settled line is refused', async () => {
  const [line] = await sql`
    SELECT ml.id FROM memo_lines ml JOIN memos m ON m.id = ml.memo_id
    WHERE m.memo_no = 'MEMO-T1'`;
  await assert.rejects(
    () => returnFromMemo({ memoLineId: line.id, carats: 0.5, on: '2024-04-21' }),
    /exceeds outstanding/i
  );
});

test('the line and memo close once fully settled', async () => {
  const [row] = await sql`
    SELECT ml.status AS line, m.status AS memo
    FROM memo_lines ml JOIN memos m ON m.id = ml.memo_id
    WHERE m.memo_no = 'MEMO-T1'`;
  assert.equal(row.line, 'settled');
  assert.equal(row.memo, 'closed');
});

test('billing posted a receivable to the ledger', async () => {
  const [row] = await sql`SELECT amount, kind FROM ledger WHERE ref_id = 'INV-1'`;
  assert.equal(row.kind, 'sale_invoice');
  assert.equal(Number(row.amount), 4800);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/memos.test.ts`
Expected: FAIL — `issueOutwardMemo is not a function`.

- [ ] **Step 3: Append to `lib/movements.ts`**

```typescript
import { withTx } from '../db/client';

export async function issueOutwardMemo(a: {
  memoNo: string; partyId: string; issuedOn: string; dueOn: string | null;
  lines: Array<{ lotId: string; carats: number; rate: number }>;
}): Promise<string> {
  return withTx(async (tx) => {
    const { rows: [memo] } = await (tx as any).query(
      `INSERT INTO memos (memo_no, direction, party_id, issued_on, due_on)
       VALUES ($1,'out',$2,$3,$4) RETURNING id`,
      [a.memoNo, a.partyId, a.issuedOn, a.dueOn]
    );
    for (const l of a.lines) {
      const { rows: [line] } = await (tx as any).query(
        `INSERT INTO memo_lines (memo_id, lot_id, carats, rate)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [memo.id, l.lotId, l.carats, l.rate]
      );
      try {
        await (tx as any).query(
          `INSERT INTO movements (lot_id, kind, carats, rate, amount, memo_line_id, moved_on)
           VALUES ($1,'memo_out_issue',$2,$3,$4,$5,$6)`,
          [l.lotId, -Math.abs(l.carats), l.rate,
           round2(Math.abs(l.carats) * l.rate), line.id, a.issuedOn]
        );
      } catch (err: any) {
        if (/insufficient stock/.test(err?.message ?? '')) throw new OverdrawError(err.message);
        throw err;
      }
    }
    return memo.id as string;
  });
}

/** Carats on this line not yet returned or billed. */
export async function memoLineOutstanding(memoLineId: string): Promise<number> {
  const [row] = await sql`
    SELECT ml.carats
           - COALESCE((SELECT SUM(ABS(m.carats)) FROM movements m
                       WHERE m.memo_line_id = ml.id AND m.kind = 'memo_out_return'), 0)
           - COALESCE((SELECT SUM(l.carats) FROM memo_line_billings l
                       WHERE l.memo_line_id = ml.id), 0) AS outstanding
    FROM memo_lines ml WHERE ml.id = ${memoLineId}`;
  return Number(row.outstanding);
}

async function closeIfSettled(tx: any, memoLineId: string) {
  const { rows: [r] } = await tx.query(
    `SELECT memo_id FROM memo_lines WHERE id = $1`, [memoLineId]);
  await tx.query(
    `UPDATE memo_lines SET status = 'settled' WHERE id = $1`, [memoLineId]);
  await tx.query(
    `UPDATE memos SET status = 'closed' WHERE id = $1
       AND NOT EXISTS (SELECT 1 FROM memo_lines WHERE memo_id = $1 AND status = 'open')`,
    [r.memo_id]);
}

export async function returnFromMemo(a: { memoLineId: string; carats: number; on: string }) {
  const outstanding = await memoLineOutstanding(a.memoLineId);
  if (a.carats - outstanding > 0.0005) {
    throw new Error(`return of ${a.carats} ct exceeds outstanding ${outstanding} ct on this memo line`);
  }
  await withTx(async (tx: any) => {
    const { rows: [ml] } = await tx.query(
      `SELECT lot_id, rate FROM memo_lines WHERE id = $1`, [a.memoLineId]);
    await tx.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, memo_line_id, moved_on)
       VALUES ($1,'memo_out_return',$2,$3,$4,$5,$6)`,
      [ml.lot_id, Math.abs(a.carats), ml.rate,
       round2(Math.abs(a.carats) * Number(ml.rate)), a.memoLineId, a.on]);
    if (outstanding - a.carats <= 0.0005) await closeIfSettled(tx, a.memoLineId);
  });
}

/** Billing moves NO carats — they left the vault at memo_out_issue.
 *  It records the billing and posts a receivable. */
export async function billMemoLine(a: {
  memoLineId: string; carats: number; on: string; invoiceNo: string;
}) {
  const outstanding = await memoLineOutstanding(a.memoLineId);
  if (a.carats - outstanding > 0.0005) {
    throw new Error(`billing of ${a.carats} ct exceeds outstanding ${outstanding} ct on this memo line`);
  }
  await withTx(async (tx: any) => {
    const { rows: [ml] } = await tx.query(
      `SELECT ml.rate, m.party_id FROM memo_lines ml
       JOIN memos m ON m.id = ml.memo_id WHERE ml.id = $1`, [a.memoLineId]);
    const amount = round2(a.carats * Number(ml.rate));
    await tx.query(
      `INSERT INTO memo_line_billings (memo_line_id, carats, amount, invoice_no, billed_on)
       VALUES ($1,$2,$3,$4,$5)`,
      [a.memoLineId, a.carats, amount, a.invoiceNo, a.on]);
    await tx.query(
      `INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
       VALUES ($1,'sale_invoice',$2,$3,'memo_line',$4)`,
      [ml.party_id, amount, a.on, a.invoiceNo]);
    if (outstanding - a.carats <= 0.0005) await closeIfSettled(tx, a.memoLineId);
  });
}
```

- [ ] **Step 4: Add the billings table — `db/migrations/004_billings.sql`**

```sql
CREATE TABLE memo_line_billings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_line_id uuid NOT NULL REFERENCES memo_lines(id) ON DELETE CASCADE,
  carats       numeric(10,3) NOT NULL CHECK (carats > 0),
  amount       numeric(14,2) NOT NULL,
  invoice_no   text NOT NULL,
  billed_on    date NOT NULL
);
CREATE INDEX memo_line_billings_line_idx ON memo_line_billings (memo_line_id);
```

- [ ] **Step 5: Apply and run tests**

Run: `npm run migrate && npm test -- tests/memos.test.ts`
Expected: PASS, 8 tests. The critical assertions are `billing must NOT move
carats again` (guards double-counting) and the three-event settlement
(guards the one-split-only bug).

- [ ] **Step 6: Commit**

```bash
git add lib/movements.ts db/migrations/004_billings.sql tests/memos.test.ts
git commit -m "feat: memo lifecycle with repeatable partial returns and billing"
```

---
## Task 8: Import — parties, lots and movements from `diamond_hisab`

**Files:**
- Create: `scripts/import.ts`
- Test: covered by Task 10's reconciliation gate.

**Interfaces:**
- Consumes: `parseLooseDate`, `partyKey`, `canonicalPartyName`, `sql`.
- Produces: a populated database. `scripts/import.ts` exports `importAll(): Promise<ImportReport>` where `ImportReport = { parties: number; lots: number; movements: number; ledgerRows: number; skipped: string[] }`.

Mapping rules, one row of `diamond_hisab` at a time:

| Source | Target |
|---|---|
| `Pur. Party` (≠ `Kaivan Stock`) | `parties` (grouped by `partyKey`), `lots.party_id` |
| `Pur. Party` = `Kaivan Stock` (164 rows) | `lots.source = 'legacy_selflot'`, no party link — **cannot** be matched to the 30 `kaivan_stock` lots (0/164 match on sieve+shape; 39.55 ct claimed vs 32.56 ct available) |
| `Diamond Type`, `Shape`, `Sieve Size`, `MM Size`, `Clarity`, `Colour` | `lots.*` verbatim |
| `Pur. Amt` > 0 | `movements` `purchase`, carats `+Carats`, `amount = Pur. Amt` (the **amount is authoritative**, not `Carats × Pur. Rate` — 7 rows disagree) |
| `Pur. Amt` = 0 (9 rows) | `movements` `adjust_in` with `notes = 'opening: no purchase side in source'` so the sale below cannot overdraw |
| `Sale Amt` > 0 | `movements` `sale`, carats `−Carats`, `amount = Sale Amt` |
| `Party Name` | `parties`, used for the sale's ledger row |

Each source row becomes **one lot** (`lot_no = 'DH-' || _id`). This is faithful to
how the sheet was kept — a row *is* a parcel bought and sold — and avoids
inventing lot merges the data does not support.

- [ ] **Step 1: Write `scripts/import.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { sql } from '../db/client';
import { parseLooseDate } from '../lib/dates';
import { partyKey, canonicalPartyName } from '../lib/normalize';

type Row = Record<string, any>;
const num = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export type ImportReport = {
  parties: number; lots: number; movements: number; ledgerRows: number; skipped: string[];
};

async function upsertParties(raws: string[]): Promise<Map<string, string>> {
  const byKey = new Map<string, string>();      // key -> longest raw spelling
  for (const r of raws) {
    const s = String(r ?? '').trim();
    if (!s || s === '-' || s.toLowerCase() === 'none') continue;
    const k = partyKey(s);
    if (!byKey.has(k) || s.length > byKey.get(k)!.length) byKey.set(k, s);
  }
  const ids = new Map<string, string>();
  for (const [k, raw] of byKey) {
    const name = canonicalPartyName(raw)!;
    const [row] = await sql`
      INSERT INTO parties (name) VALUES (${name})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
    ids.set(k, row.id);
  }
  return ids;
}

export async function importAll(): Promise<ImportReport> {
  const data = JSON.parse(readFileSync('ref/initial_data.json', 'utf8'));
  const dh: Row[] = data.diamond_hisab;
  const skipped: string[] = [];

  const partyIds = await upsertParties([
    ...dh.map(r => r['Pur. Party']),
    ...dh.map(r => r['Party Name']),
    ...data.kaivan_stock.map((r: Row) => r['Party Name']),
    ...data.jewellery_master.map((r: Row) => r['Cust Name']),
    ...data.jewellery_master.map((r: Row) => r['Purchase Party']),
  ]);
  const idFor = (raw: any) => {
    const s = String(raw ?? '').trim();
    if (!s || s === '-' || s.toLowerCase() === 'none') return null;
    return partyIds.get(partyKey(s)) ?? null;
  };

  let lots = 0, movements = 0, ledgerRows = 0;

  for (const r of dh) {
    const carats = num(r['Carats']);
    if (carats <= 0) { skipped.push(`${r._id}: carats <= 0`); continue; }

    const purParty = String(r['Pur. Party'] ?? '').trim();
    const isSelfLot = purParty === 'Kaivan Stock';
    const purDate = parseLooseDate(r['Pur. Date']) ?? parseLooseDate(r['Order Date']) ?? '2024-04-01';
    const saleDate = parseLooseDate(r['Order Date']) ?? purDate;

    const [lot] = await sql`
      INSERT INTO lots (lot_no, party_id, stone_type, shape, sieve_size, mm_size,
                        clarity, colour, cost_rate, source, opened_on)
      VALUES (${'DH-' + r._id}, ${isSelfLot ? null : idFor(purParty)},
              ${String(r['Diamond Type'] ?? 'Unknown').trim()},
              ${r['Shape']}, ${r['Sieve Size']}, ${r['MM Size']},
              ${r['Clarity']}, ${r['Colour']},
              ${num(r['Pur. Rate']) || null},
              ${isSelfLot ? 'legacy_selflot' : 'purchase'}, ${purDate})
      RETURNING id`;
    lots++;

    // ---- carat ledger ----
    const purAmt = num(r['Pur. Amt']);
    if (purAmt > 0) {
      await sql`INSERT INTO movements (lot_id, kind, carats, rate, amount, ref_type, ref_id, moved_on)
                VALUES (${lot.id}, 'purchase', ${carats}, ${num(r['Pur. Rate']) || null},
                        ${round2(purAmt)}, 'diamond_hisab', ${r._id}, ${purDate})`;
    } else {
      await sql`INSERT INTO movements (lot_id, kind, carats, ref_type, ref_id, moved_on, notes)
                VALUES (${lot.id}, 'adjust_in', ${carats}, 'diamond_hisab', ${r._id},
                        ${purDate}, 'opening: no purchase side in source')`;
    }
    movements++;

    const saleAmt = num(r['Sale Amt']);
    if (saleAmt > 0) {
      await sql`INSERT INTO movements (lot_id, kind, carats, rate, amount, ref_type, ref_id, moved_on)
                VALUES (${lot.id}, 'sale', ${-carats}, ${num(r['Sale Rate']) || null},
                        ${round2(saleAmt)}, 'diamond_hisab', ${r._id}, ${saleDate})`;
      movements++;
    }

    // ---- money ledger: invoice then payments-to-date as one net row each ----
    const supplierId = isSelfLot ? null : idFor(purParty);
    if (purAmt > 0 && supplierId) {
      await sql`INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
                VALUES (${supplierId}, 'purchase_invoice', ${-round2(purAmt)}, ${purDate},
                        'diamond_hisab', ${r._id})`;
      ledgerRows++;
      const paid = num(r['Pay. Paid']);
      if (paid > 0) {
        await sql`INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id, notes)
                  VALUES (${supplierId}, 'payment_out', ${round2(paid)},
                          ${parseLooseDate(r['Payment Date']) ?? purDate},
                          'diamond_hisab', ${r._id}, 'imported aggregate payment')`;
        ledgerRows++;
      }
    }

    const clientId = idFor(r['Party Name']);
    if (saleAmt > 0 && clientId) {
      await sql`INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
                VALUES (${clientId}, 'sale_invoice', ${round2(saleAmt)}, ${saleDate},
                        'diamond_hisab', ${r._id})`;
      ledgerRows++;
      const recd = num(r['Sale Amt Paid']);
      if (recd > 0) {
        await sql`INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id, notes)
                  VALUES (${clientId}, 'payment_in', ${-round2(recd)},
                          ${parseLooseDate(r['Payment Date_1']) ?? saleDate},
                          'diamond_hisab', ${r._id}, 'imported aggregate receipt')`;
        ledgerRows++;
      }
    } else if (saleAmt > 0) {
      skipped.push(`${r._id}: sale of ${saleAmt} has no identifiable client party`);
    }
  }

  return { parties: partyIds.size, lots, movements, ledgerRows, skipped };
}
```

- [ ] **Step 2: Add the CLI entry point at the bottom of the file**

```typescript
if (process.argv[1]?.endsWith('import.ts')) {
  importAll().then(rep => {
    console.log(rep);
    if (rep.skipped.length) console.log('skipped:', rep.skipped.slice(0, 20));
  });
}
```

- [ ] **Step 3: Run the import against a clean test branch**

```bash
npx tsx -r dotenv/config -e "
import { sql } from './db/client';
(async()=>{ await sql\`TRUNCATE ledger, movements, memo_line_billings, memo_lines, memos, lots, jewellery_orders, parties CASCADE\`; console.log('cleared'); })();
" dotenv_config_path=.env.local
npm run import
```

Expected: `{ parties: 109, lots: 1964, movements: 3919, ledgerRows: ..., skipped: [...] }`.
`movements` = 1964 lots × 1 purchase/opening + 1955 sales = 3919. If the count
differs, stop and reconcile before proceeding — Task 10 will fail anyway.

- [ ] **Step 4: Commit**

```bash
git add scripts/import.ts
git commit -m "feat: import diamond_hisab into lots, movements and ledger"
```

---

## Task 9: Import — `kaivan_stock` and `jewellery_master`

**Files:**
- Modify: `scripts/import.ts`

**Interfaces:**
- Consumes: Task 8's helpers.
- Produces: 30 additional lots (`lot_no = 'KS-n'`) and 37 `jewellery_orders` rows.

`kaivan_stock` carries `Carats` / `Stock Used` / `Stock Balance` with all 30 rows
internally consistent (`Carats − Used = Balance`, 0 mismatches). Import the
purchase for `Carats` and a single `consumed_jewellery` movement for `Stock Used`,
so the derived balance reproduces `Stock Balance` exactly.

- [ ] **Step 1: Append to `importAll`, before the `return`**

```typescript
  for (const r of data.kaivan_stock as Row[]) {
    const carats = num(r['Carats']);
    if (carats <= 0) { skipped.push(`${r._id}: kaivan lot with no carats`); continue; }
    const rate = num(r['Rate']);
    const [lot] = await sql`
      INSERT INTO lots (lot_no, party_id, stone_type, shape, sieve_size, mm_size,
                        cost_rate, source, opened_on)
      VALUES (${'KS-' + r._id}, ${idFor(r['Party Name'])},
              ${String(r['Stone Type'] ?? 'Lab Grown').trim()}, ${r['Shape']},
              ${r['Seive Size']}, ${r['MM']}, ${rate || null}, 'opening', '2024-04-01')
      RETURNING id`;
    lots++;
    await sql`INSERT INTO movements (lot_id, kind, carats, rate, amount, ref_type, ref_id, moved_on)
              VALUES (${lot.id}, 'purchase', ${carats}, ${rate || null},
                      ${round2(num(r['Total Rs']))}, 'kaivan_stock', ${r._id}, '2024-04-01')`;
    movements++;
    const used = num(r['Stock Used']);
    if (used > 0) {
      await sql`INSERT INTO movements (lot_id, kind, carats, rate, amount, ref_type, ref_id, moved_on, notes)
                VALUES (${lot.id}, 'consumed_jewellery', ${-used}, ${rate || null},
                        ${round2(used * rate)}, 'kaivan_stock', ${r._id}, '2024-04-01',
                        'imported aggregate consumption')`;
      movements++;
    }
  }

  for (const r of data.jewellery_master as Row[]) {
    const orderNo = String(r['Cust Order No'] ?? '').trim();
    if (!orderNo) { skipped.push(`${r._id}: jewellery order with no order number`); continue; }
    await sql`
      INSERT INTO jewellery_orders (order_no, ordered_on, party_id, product_type, metal_type,
                                    metal_colour, gross_wt, net_wt, metal_rate, metal_amount,
                                    labour_amount, other_charges, client_total, remarks)
      VALUES (${orderNo}, ${parseLooseDate(r['Date'])}, ${idFor(r['Cust Name'])},
              ${r['Product type']}, ${String(r['Metal Type'] ?? '').replace(/\s+/g, '')},
              ${r['Metal Colour']}, ${num(r['Gross Wt']) || null}, ${num(r['Net Wt']) || null},
              ${num(r['Metal Rate']) || null}, ${round2(num(r['Metal Amt'])) || null},
              ${round2(num(r['Lab Charges'])) || null},
              ${round2(num(r['Hm & Engr']) + num(r['Cad Charges'])) || null},
              ${round2(num(r['Client Total'])) || null}, ${r['Remarks']})
      ON CONFLICT (order_no) DO NOTHING`;

    const clientId = idFor(r['Cust Name']);
    const total = num(r['Client Total']);
    if (clientId && total > 0) {
      const on = parseLooseDate(r['Date']) ?? '2024-04-01';
      await sql`INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
                VALUES (${clientId}, 'sale_invoice', ${round2(total)}, ${on}, 'jewellery', ${orderNo})`;
      ledgerRows++;
      const recd = num(r['Payment status from client']);
      if (recd > 0) {
        await sql`INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id, notes)
                  VALUES (${clientId}, 'payment_in', ${-round2(recd)},
                          ${parseLooseDate(r['Amt Rec Date']) ?? on}, 'jewellery', ${orderNo},
                          'imported aggregate receipt')`;
        ledgerRows++;
      }
    }
  }
```

Note: `Metal Type` is normalized with `.replace(/\s+/g,'')` to collapse the
`G14`/`G 14` and `G18`/`G 18` split measured in the source (7 and 1 rows).

- [ ] **Step 2: Re-run a clean import**

```bash
npx tsx -r dotenv/config -e "
import { sql } from './db/client';
(async()=>{ await sql\`TRUNCATE ledger, movements, memo_line_billings, memo_lines, memos, lots, jewellery_orders, parties CASCADE\`; })();
" dotenv_config_path=.env.local
npm run import
```

Expected: `lots: 1994`, `jewellery_orders` 37 rows.

- [ ] **Step 3: Commit**

```bash
git add scripts/import.ts
git commit -m "feat: import kaivan_stock lots and jewellery orders"
```

---

## Task 10: Reconciliation gate

Nothing downstream may start until these pass. They assert the imported database
reproduces the workbook to the rupee.

**Files:**
- Create: `tests/reconcile.test.ts`

**Interfaces:**
- Consumes: the populated database.
- Produces: nothing — it is a gate.

- [ ] **Step 1: Write the test**

```typescript
// tests/reconcile.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';

const near = (actual: number, expected: number, tol = 0.05, what = '') =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${what}: expected ${expected}, got ${actual} (diff ${(actual - expected).toFixed(4)})`);

test('purchase movements reproduce the workbook purchase total', async () => {
  const [r] = await sql`SELECT COALESCE(SUM(amount),0) AS t FROM movements
                        WHERE kind = 'purchase' AND ref_type = 'diamond_hisab'`;
  near(Number(r.t), 15920488.26, 0.05, 'Pur. Amt');
});

test('sale movements reproduce the workbook sale total', async () => {
  const [r] = await sql`SELECT COALESCE(SUM(amount),0) AS t FROM movements
                        WHERE kind = 'sale' AND ref_type = 'diamond_hisab'`;
  near(Number(r.t), 18099078.81, 0.05, 'Sale Amt');
});

test('total carats moved in from diamond_hisab match the workbook', async () => {
  const [r] = await sql`SELECT COALESCE(SUM(carats),0) AS t FROM movements
                        WHERE carats > 0 AND ref_type = 'diamond_hisab'`;
  near(Number(r.t), 1416.168, 0.005, 'Carats');
});

test('kaivan stock lots reproduce carats, consumption and balance', async () => {
  const [r] = await sql`
    SELECT COALESCE(SUM(CASE WHEN m.carats > 0 THEN m.carats END),0)      AS inn,
           COALESCE(-SUM(CASE WHEN m.carats < 0 THEN m.carats END),0)     AS used,
           COALESCE(SUM(m.carats),0)                                      AS bal
    FROM movements m JOIN lots l ON l.id = m.lot_id
    WHERE l.source = 'opening'`;
  near(Number(r.inn), 48.810, 0.005, 'KS carats');
  near(Number(r.used), 32.560, 0.005, 'KS used');
  near(Number(r.bal), 16.250, 0.005, 'KS balance');
});

test('supplier payable reproduces the workbook balance', async () => {
  const [r] = await sql`
    SELECT COALESCE(-SUM(amount),0) AS t FROM ledger
    WHERE ref_type = 'diamond_hisab' AND kind IN ('purchase_invoice','payment_out')`;
  near(Number(r.t), 701128.02, 1.0, 'diamond payable');
});

test('client receivable reproduces the workbook balance', async () => {
  const [r] = await sql`
    SELECT COALESCE(SUM(amount),0) AS t FROM ledger
    WHERE ref_type = 'diamond_hisab' AND kind IN ('sale_invoice','payment_in')`;
  near(Number(r.t), 1192544.67, 1.0, 'diamond receivable');
});

test('jewellery receivable reproduces the workbook balance', async () => {
  const [r] = await sql`
    SELECT COALESCE(SUM(amount),0) AS t FROM ledger WHERE ref_type = 'jewellery'`;
  near(Number(r.t), 183604.30, 1.0, 'jewellery receivable');
});

test('no lot has a negative balance', async () => {
  const rows = await sql`SELECT lot_no, balance FROM lot_balances WHERE balance < -0.0005`;
  assert.deepEqual(rows, [], `negative lots: ${JSON.stringify(rows.slice(0, 5))}`);
});

test('row counts match the source workbook', async () => {
  const [l] = await sql`SELECT count(*)::int AS n FROM lots`;
  const [j] = await sql`SELECT count(*)::int AS n FROM jewellery_orders`;
  const [p] = await sql`SELECT count(*)::int AS n FROM parties`;
  assert.equal(l.n, 1994, 'lots = 1964 diamond_hisab + 30 kaivan_stock');
  assert.equal(j.n, 37);
  assert.ok(p.n <= 116 && p.n >= 100, `parties collapsed to ${p.n}, expected ~109`);
});
```

- [ ] **Step 2: Run the gate**

Run: `npm test -- tests/reconcile.test.ts`
Expected: PASS, 9 tests.

If the payable/receivable tests fail, the most likely cause is a sale or purchase
whose party string did not resolve — check `ImportReport.skipped` from Task 8,
which lists those rows explicitly. Fix the mapping, re-truncate, re-import. Do
**not** widen the tolerance to make the test pass.

- [ ] **Step 3: Commit**

```bash
git add tests/reconcile.test.ts
git commit -m "test: reconciliation gate against workbook totals"
```

---

## Task 11: Aging buckets and party balances

The previous plan specified 0-30 / 30-60 / 60+ aging; `app.js` has none, and its
accounts hub renders 197 receivable rows across only 5 real parties and 114
payable rows across 7. Aggregate by party here.

**Files:**
- Create: `lib/ledger.ts`, `db/migrations/005_aging.sql`
- Test: `tests/ledger.test.ts`

**Interfaces:**
- Consumes: `sql`.
- Produces:
  - `partyBalances(): Promise<Array<{ partyId: string; partyName: string; receivable: number; payable: number; net: number }>>`
  - `agingBuckets(asOf: string): Promise<Array<{ partyId: string; partyName: string; d0_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number }>>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ledger.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../db/client';
import { agingBuckets, partyBalances } from '../lib/ledger';

let partyId: string;

before(async () => {
  const [p] = await sql`INSERT INTO parties (name) VALUES ('Aging Test Co')
                        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
  partyId = p.id;
  await sql`DELETE FROM ledger WHERE party_id = ${partyId}`;
  await sql`INSERT INTO ledger (party_id, kind, amount, dated_on, ref_id) VALUES
    (${partyId}, 'sale_invoice', 1000, '2024-06-20', 'AG1'),
    (${partyId}, 'sale_invoice', 2000, '2024-05-20', 'AG2'),
    (${partyId}, 'sale_invoice', 4000, '2024-03-01', 'AG3'),
    (${partyId}, 'payment_in',   -500, '2024-06-25', 'AG4')`;
});

test('buckets split by invoice age as of a given date', async () => {
  const rows = await agingBuckets('2024-06-30');
  const r = rows.find(x => x.partyId === partyId)!;
  assert.equal(r.d0_30, 1000);      // 2024-06-20 is 10 days old
  assert.equal(r.d31_60, 2000);     // 2024-05-20 is 41 days old
  assert.equal(r.d90_plus, 4000);   // 2024-03-01 is 121 days old
});

test('party balance nets payments against invoices', async () => {
  const rows = await partyBalances();
  const r = rows.find(x => x.partyId === partyId)!;
  assert.equal(r.net, 6500);
  assert.equal(r.receivable, 7000);
});

test('one row per party, not one per invoice', async () => {
  const rows = await partyBalances();
  const mine = rows.filter(x => x.partyId === partyId);
  assert.equal(mine.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ledger.test.ts`
Expected: FAIL — `Cannot find module '../lib/ledger'`.

- [ ] **Step 3: Write `db/migrations/005_aging.sql`**

```sql
CREATE OR REPLACE FUNCTION aging_as_of(as_of date)
RETURNS TABLE (
  party_id uuid, party_name text,
  d0_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, total numeric
) AS $$
  SELECT p.id, p.name,
    COALESCE(SUM(CASE WHEN as_of - g.dated_on BETWEEN 0  AND 30 THEN g.amount END), 0),
    COALESCE(SUM(CASE WHEN as_of - g.dated_on BETWEEN 31 AND 60 THEN g.amount END), 0),
    COALESCE(SUM(CASE WHEN as_of - g.dated_on BETWEEN 61 AND 90 THEN g.amount END), 0),
    COALESCE(SUM(CASE WHEN as_of - g.dated_on > 90              THEN g.amount END), 0),
    COALESCE(SUM(g.amount), 0)
  FROM parties p
  JOIN ledger g ON g.party_id = p.id AND g.kind = 'sale_invoice' AND g.dated_on <= as_of
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(g.amount), 0) <> 0;
$$ LANGUAGE sql STABLE;
```

- [ ] **Step 4: Write `lib/ledger.ts`**

```typescript
import { sql } from '../db/client';

export async function partyBalances() {
  const rows = await sql`SELECT * FROM party_balances WHERE net <> 0 ORDER BY ABS(net) DESC`;
  return rows.map((r: any) => ({
    partyId: r.party_id, partyName: r.party_name,
    receivable: Number(r.receivable), payable: Number(r.payable), net: Number(r.net),
  }));
}

export async function agingBuckets(asOf: string) {
  const rows = await sql`SELECT * FROM aging_as_of(${asOf}::date) ORDER BY total DESC`;
  return rows.map((r: any) => ({
    partyId: r.party_id, partyName: r.party_name,
    d0_30: Number(r.d0_30), d31_60: Number(r.d31_60),
    d61_90: Number(r.d61_90), d90_plus: Number(r.d90_plus), total: Number(r.total),
  }));
}

export async function postLedger(a: {
  partyId: string; kind: 'purchase_invoice' | 'sale_invoice' | 'payment_in' | 'payment_out' | 'adjustment';
  amount: number; on: string; refType?: string; refId?: string; notes?: string;
}) {
  const [row] = await sql`
    INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id, notes)
    VALUES (${a.partyId}, ${a.kind}, ${a.amount}, ${a.on},
            ${a.refType ?? null}, ${a.refId ?? null}, ${a.notes ?? null})
    RETURNING id`;
  return row.id as string;
}
```

- [ ] **Step 5: Apply and run tests**

Run: `npm run migrate && npm test -- tests/ledger.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/005_aging.sql lib/ledger.ts tests/ledger.test.ts
git commit -m "feat: party-level balances and aging buckets"
```

---

## Task 12: API routes

**Files:**
- Create: `app/api/stock/route.ts`, `app/api/memos/route.ts`, `app/api/memos/[id]/settle/route.ts`, `app/api/accounts/route.ts`
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: `lib/movements.ts`, `lib/ledger.ts`.
- Produces: HTTP JSON. `GET /api/stock` → `{ lots: LotBalance[] }`; `POST /api/memos` → `{ memoId }` or `409 { error }`; `POST /api/memos/[id]/settle` → `{ ok: true }`; `GET /api/accounts?asOf=YYYY-MM-DD` → `{ balances, aging }`.

- [ ] **Step 1: Write `app/api/stock/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@/db/client';

export async function GET() {
  const lots = await sql`
    SELECT lot_id, lot_no, stone_type, shape, sieve_size, mm_size,
           party_name, cost_rate, balance, exposure
    FROM lot_balances WHERE balance <> 0 OR exposure <> 0
    ORDER BY balance DESC`;
  return NextResponse.json({ lots });
}
```

- [ ] **Step 2: Write `app/api/memos/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { issueOutwardMemo, OverdrawError } from '@/lib/movements';

export async function GET() {
  const memos = await sql`
    SELECT m.id, m.memo_no, m.issued_on, m.due_on, m.status, p.name AS party_name,
           COALESCE(SUM(ml.carats), 0) AS carats,
           COALESCE(SUM(ml.carats * ml.rate), 0) AS value,
           (m.due_on IS NOT NULL AND m.due_on < CURRENT_DATE AND m.status = 'open') AS overdue
    FROM memos m JOIN parties p ON p.id = m.party_id
    LEFT JOIN memo_lines ml ON ml.memo_id = m.id
    WHERE m.direction = 'out'
    GROUP BY m.id, p.name ORDER BY m.issued_on DESC`;
  return NextResponse.json({ memos });
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const memoId = await issueOutwardMemo(body);
    return NextResponse.json({ memoId }, { status: 201 });
  } catch (e: any) {
    if (e instanceof OverdrawError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Write `app/api/memos/[id]/settle/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { returnFromMemo, billMemoLine } from '@/lib/movements';

export async function POST(req: Request) {
  const { memoLineId, carats, on, action, invoiceNo } = await req.json();
  try {
    if (action === 'return') await returnFromMemo({ memoLineId, carats, on });
    else if (action === 'bill') await billMemoLine({ memoLineId, carats, on, invoiceNo });
    else return NextResponse.json({ error: 'action must be return or bill' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
}
```

- [ ] **Step 4: Write `app/api/accounts/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { partyBalances, agingBuckets } from '@/lib/ledger';

export async function GET(req: Request) {
  const asOf = new URL(req.url).searchParams.get('asOf')
    ?? new Date().toISOString().slice(0, 10);
  const [balances, aging] = await Promise.all([partyBalances(), agingBuckets(asOf)]);
  return NextResponse.json({ balances, aging, asOf });
}
```

- [ ] **Step 5: Write `tests/api.test.ts`**

```typescript
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';

test('GET /api/stock returns lots with balance and exposure', async () => {
  const res = await fetch(`${BASE}/api/stock`);
  assert.equal(res.status, 200);
  const { lots } = await res.json();
  assert.ok(lots.length > 0);
  assert.ok('balance' in lots[0] && 'exposure' in lots[0]);
});

test('POST /api/memos refuses an overdraw with 409', async () => {
  const stock = await (await fetch(`${BASE}/api/stock`)).json();
  const lot = stock.lots[0];
  const accounts = await (await fetch(`${BASE}/api/accounts`)).json();
  const res = await fetch(`${BASE}/api/memos`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      memoNo: `API-OVERDRAW-${Date.now()}`,
      partyId: accounts.balances[0].partyId,
      issuedOn: '2026-08-27', dueOn: '2026-09-03',
      lines: [{ lotId: lot.lot_id, carats: Number(lot.balance) + 1000, rate: 5000 }],
    }),
  });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /insufficient/i);
});

test('GET /api/accounts returns aging buckets', async () => {
  const res = await fetch(`${BASE}/api/accounts?asOf=2026-08-27`);
  const { aging } = await res.json();
  assert.ok(Array.isArray(aging));
  if (aging.length) assert.ok('d90_plus' in aging[0]);
});
```

- [ ] **Step 6: Run the app and the API tests**

```bash
npm run dev &
sleep 5
npm test -- tests/api.test.ts
kill %1
```

Expected: PASS, 3 tests. The 409 test is the one that matters — it proves the
overdraw guard survives the trip through HTTP.

- [ ] **Step 7: Commit**

```bash
git add app/api tests/api.test.ts
git commit -m "feat: stock, memo and accounts API routes"
```

---

## Task 13: UI — stock, memos, accounts, dashboard

Port the four views from `index.html`/`app.js`, which already have a working
layout and are the design reference. Only the data source changes — plus the
three columns that could not exist before: lot `exposure`, memo outstanding,
and aging buckets.

**Files:**
- Create: `app/stock/page.tsx`, `app/memos/page.tsx`, `app/accounts/page.tsx`, `app/page.tsx`, `app/lib/format.ts`
- Delete (last step): `app.js`, `data.js`, `index.html`, `styles.css`

**Interfaces:**
- Consumes: the API routes from Task 12.
- Produces: the running application.

- [ ] **Step 1: Write `app/lib/format.ts`**

```typescript
export const inr = (v: unknown) =>
  '₹' + Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ct = (v: unknown) =>
  Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ct';
```

- [ ] **Step 2: Write `app/stock/page.tsx` (server component)**

```tsx
import { sql } from '@/db/client';
import { inr, ct } from '@/app/lib/format';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const lots = await sql`
    SELECT lot_no, stone_type, shape, sieve_size, party_name, cost_rate, balance, exposure
    FROM lot_balances WHERE balance <> 0 OR exposure <> 0
    ORDER BY balance DESC LIMIT 500`;
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Stock</h1>
      <table className="w-full text-sm">
        <thead className="text-left border-b">
          <tr><th>Lot</th><th>Type</th><th>Shape</th><th>Sieve</th><th>Party</th>
              <th className="text-right">In vault</th><th className="text-right">On memo</th>
              <th className="text-right">Value</th></tr>
        </thead>
        <tbody>
          {lots.map((l: any) => (
            <tr key={l.lot_no} className="border-b">
              <td className="font-mono">{l.lot_no}</td>
              <td>{l.stone_type}</td><td>{l.shape}</td><td>{l.sieve_size}</td>
              <td>{l.party_name ?? '—'}</td>
              <td className="text-right">{ct(l.balance)}</td>
              <td className="text-right text-indigo-600">
                {Number(l.exposure) > 0 ? ct(l.exposure) : '—'}
              </td>
              <td className="text-right">{inr(Number(l.balance) * Number(l.cost_rate ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Write `app/accounts/page.tsx`**

```tsx
import { agingBuckets, partyBalances } from '@/lib/ledger';
import { inr } from '@/app/lib/format';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const asOf = new Date().toISOString().slice(0, 10);
  const [balances, aging] = await Promise.all([partyBalances(), agingBuckets(asOf)]);
  return (
    <main className="p-6 space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-4">Receivables aging as of {asOf}</h1>
        <table className="w-full text-sm">
          <thead className="text-left border-b">
            <tr><th>Party</th><th className="text-right">0–30</th><th className="text-right">31–60</th>
                <th className="text-right">61–90</th><th className="text-right">90+</th>
                <th className="text-right">Total</th></tr>
          </thead>
          <tbody>
            {aging.map(a => (
              <tr key={a.partyId} className="border-b">
                <td>{a.partyName}</td>
                <td className="text-right">{inr(a.d0_30)}</td>
                <td className="text-right">{inr(a.d31_60)}</td>
                <td className="text-right">{inr(a.d61_90)}</td>
                <td className="text-right text-red-600 font-semibold">{inr(a.d90_plus)}</td>
                <td className="text-right font-bold">{inr(a.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="text-xl font-bold mb-4">Party balances</h2>
        <table className="w-full text-sm">
          <thead className="text-left border-b">
            <tr><th>Party</th><th className="text-right">Receivable</th>
                <th className="text-right">Payable</th><th className="text-right">Net</th></tr>
          </thead>
          <tbody>
            {balances.map(b => (
              <tr key={b.partyId} className="border-b">
                <td>{b.partyName}</td>
                <td className="text-right">{inr(b.receivable)}</td>
                <td className="text-right">{inr(b.payable)}</td>
                <td className={`text-right font-bold ${b.net < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {inr(b.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Write `app/page.tsx` — the dashboard**

The KPIs are now single aggregates rather than the hand-summed loops in
`app.js:297`. Note that the profit figure here is real: the old dashboard
displayed a hardcoded `10.9%` because it read `r['Pur Amt']` where the column
is `Pur. Amt`, so its cost was always zero.

```tsx
import { sql } from '@/db/client';
import { inr, ct } from '@/app/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [k] = await sql`
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM movements WHERE kind = 'sale')          AS revenue,
      (SELECT COALESCE(SUM(amount),0) FROM movements WHERE kind = 'purchase')      AS cost,
      (SELECT COALESCE(SUM(balance),0) FROM lot_balances)                          AS vault_ct,
      (SELECT COALESCE(SUM(balance * COALESCE(cost_rate,0)),0) FROM lot_balances)  AS vault_value,
      (SELECT COALESCE(SUM(exposure),0) FROM lot_balances)                         AS exposure_ct,
      (SELECT COALESCE(SUM(amount),0) FROM ledger
        WHERE kind IN ('sale_invoice','payment_in'))                              AS receivable,
      (SELECT COALESCE(-SUM(amount),0) FROM ledger
        WHERE kind IN ('purchase_invoice','payment_out'))                          AS payable`;

  const revenue = Number(k.revenue), cost = Number(k.cost);
  const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;

  const cards = [
    ['Revenue', inr(revenue)],
    ['Gross profit', `${inr(revenue - cost)} (${margin.toFixed(1)}%)`],
    ['Receivable', inr(k.receivable)],
    ['Payable', inr(k.payable)],
    ['In vault', `${ct(k.vault_ct)} · ${inr(k.vault_value)}`],
    ['Out on memo', ct(k.exposure_ct)],
  ] as const;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="border rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
            <div className="text-xl font-bold mt-1">{value}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Write `app/memos/page.tsx`**

```tsx
import { sql } from '@/db/client';
import { inr, ct } from '@/app/lib/format';

export const dynamic = 'force-dynamic';

export default async function MemosPage() {
  const memos = await sql`
    SELECT m.id, m.memo_no, m.issued_on, m.due_on, m.status, p.name AS party_name,
           COALESCE(SUM(ml.carats), 0) AS carats,
           COALESCE(SUM(ml.carats * ml.rate), 0) AS value,
           (m.due_on IS NOT NULL AND m.due_on < CURRENT_DATE AND m.status = 'open') AS overdue
    FROM memos m JOIN parties p ON p.id = m.party_id
    LEFT JOIN memo_lines ml ON ml.memo_id = m.id
    WHERE m.direction = 'out'
    GROUP BY m.id, p.name ORDER BY m.issued_on DESC`;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Outward memos (Jangad)</h1>
      <table className="w-full text-sm">
        <thead className="text-left border-b">
          <tr><th>Memo</th><th>Client</th><th>Issued</th><th>Due</th>
              <th className="text-right">Carats</th><th className="text-right">Value</th><th>Status</th></tr>
        </thead>
        <tbody>
          {memos.map((m: any) => (
            <tr key={m.id} className={`border-b ${m.overdue ? 'bg-red-50' : ''}`}>
              <td className="font-mono">{m.memo_no}</td>
              <td>{m.party_name}</td>
              <td>{m.issued_on}</td>
              <td className={m.overdue ? 'text-red-600 font-semibold' : ''}>{m.due_on ?? '—'}</td>
              <td className="text-right">{ct(m.carats)}</td>
              <td className="text-right">{inr(m.value)}</td>
              <td>{m.overdue ? 'Overdue' : m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 6: Verify in the browser**

```bash
npm run dev
```

Visit `/`, `/stock`, `/memos`, `/accounts`. Confirm against the reconciliation
figures: dashboard revenue `₹1,81,00,000` order of magnitude, in-vault carats
include the `16.250 ct` from `kaivan_stock`, accounts aging totals to the
`₹11,92,544.67` diamond receivable plus `₹1,83,604.30` jewellery.

- [ ] **Step 7: Retire the old app**

```bash
git rm app.js data.js index.html styles.css
git commit -m "chore: retire localStorage prototype, superseded by Next.js + Neon"
```

Keep `ref/initial_data.json` and the `.xlsx` — they are the import source and the
audit trail for the reconciliation gate.

- [ ] **Step 8: Full suite**

Run: `npm test`
Expected: all suites pass, including `tests/reconcile.test.ts`.

---

## Deliberately not in this plan

- **Sieve/clarity/colour master tables.** 509 / 29 / 22 distinct free-text values. Curating them is data entry, not code; the strings import verbatim and a lookup table can be added in front later without touching `movements`.
- **Valuation at market rate.** The old plan promised "stock at cost vs market"; no market-rate field exists anywhere in the source workbook, so there is nothing to value against. Stock is carried at `cost_rate`. Add a `rate_cards` table when you start recording quotes.
- **FIFO/weighted-average COGS.** Every lot here is a single parcel with one cost rate, so COGS is `balance × cost_rate`. Add a costing method when a lot starts receiving multiple purchases at different rates.
- **Auth and multi-user.** Single operator today. Add when a second person touches the data — the append-only ledger already gives the audit trail that makes it worth doing.
- **GST / e-invoicing.** Not in the source workbook at all.
- **Inward memo UI.** The domain functions (`recordMemoInReceipt`, `recordMemoInReturn`) exist from Task 6 and the schema supports `direction = 'in'`; the screens are a copy of Task 13 Step 5 with the direction flipped. Build when vendor consignment volume justifies it.
- **The three-decimal carat rounding.** `numeric(10,3)` matches the source precision. If parcels get finer, widen the scale in one migration; the tolerance constants (`0.0005`) move with it.
