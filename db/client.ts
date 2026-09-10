import { neon, Pool } from '@neondatabase/serverless';

// Reads DATABASE_URL only. The test suite swaps in TEST_DATABASE_URL via
// tests/use-test-db.ts (loaded with --import) BEFORE this module is evaluated,
// so a stale or placeholder TEST_DATABASE_URL can never capture the real app.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.local.example to .env.local.');

/** Tagged-template query for reads and single-statement writes. */
export const sql = neon(url);

/**
 * Who is posting. Set once at startup by lib/auth/server so the database layer
 * can stamp rows without every ledger function taking an `actor` argument --
 * and so a posting path added later cannot quietly skip attribution.
 *
 * Unset (tests, scripts) means the rows are honestly unattributed rather than
 * attributed to someone who was not there.
 */
let actorResolver: (() => Promise<string | null>) | null = null;

export function setActorResolver(fn: () => Promise<string | null>) {
  actorResolver = fn;
}

/** Runs fn inside one transaction. Every multi-statement mutation uses this. */
export async function withTx<T>(fn: (tx: PoolClientLike) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(..., is_local => true) is SET LOCAL that accepts a bind
    // parameter: scoped to this transaction, so it cannot leak to whoever
    // borrows this pooled connection next, and not string-concatenated.
    const actor = await actorResolver?.().catch(() => null);
    if (actor) await client.query(`SELECT set_config('app.actor', $1, true)`, [actor]);
    const out = await fn(client as unknown as PoolClientLike);
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

export type PoolClientLike = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

/** Runs a whole .sql file (multiple statements) outside the http driver. */
export async function runSqlFile(contents: string): Promise<void> {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query(contents);
  } finally {
    client.release();
    await pool.end();
  }
}
