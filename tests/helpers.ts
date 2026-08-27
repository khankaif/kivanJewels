import { withTx, type PoolClientLike } from '@/db/client';

class Rollback extends Error {}

/**
 * Runs fn inside a transaction that is ALWAYS rolled back.
 *
 * `movements` is append-only (a trigger blocks UPDATE and DELETE), so rollback
 * is the only way to remove test fixtures. This lets the suite run safely
 * against a database holding real data.
 */
export async function inRollback(fn: (c: PoolClientLike) => Promise<void>): Promise<void> {
  try {
    await withTx(async (c) => {
      await fn(c);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

export async function makeFixtures(c: PoolClientLike, carats = 10) {
  const { rows: [party] } = await c.query(
    `INSERT INTO parties (name) VALUES ($1) RETURNING id`,
    [`ZZ Test Party ${Date.now()}-${Math.random()}`],
  );
  const { rows: [lot] } = await c.query(
    `INSERT INTO lots (lot_no, stone_type, cost_rate, source, opened_on)
     VALUES ($1,'Lab Grown',4000,'purchase','2024-04-01') RETURNING id`,
    [`ZZ-TEST-${Date.now()}-${Math.random()}`],
  );
  await c.query(
    `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
     VALUES ($1,'purchase',$2,4000,$3,'2024-04-01')`,
    [lot.id, carats, carats * 4000],
  );
  return { partyId: party.id as string, lotId: lot.id as string };
}
