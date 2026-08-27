import { neon, Pool } from '@neondatabase/serverless';

// Reads DATABASE_URL only. The test suite swaps in TEST_DATABASE_URL via
// tests/use-test-db.ts (loaded with --import) BEFORE this module is evaluated,
// so a stale or placeholder TEST_DATABASE_URL can never capture the real app.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.local.example to .env.local.');

/** Tagged-template query for reads and single-statement writes. */
export const sql = neon(url);

/** Runs fn inside one transaction. Every multi-statement mutation uses this. */
export async function withTx<T>(fn: (tx: PoolClientLike) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
