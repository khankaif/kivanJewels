import { sql, withTx, type PoolClientLike } from '@/db/client';

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

/**
 * A chart size of its own, so a test's spec is a stock unit no other test
 * shares. Stock is identified by size now (the lots' size_id foreign key), so
 * a spec needs a real size row; a fresh shape per call keeps the bands from
 * overlapping. Test shapes over an hour old that nothing uses are swept
 * first -- only old ones, since test files run in parallel and a fresh size
 * may belong to a test that is about to use it.
 */
export async function testSize(): Promise<{ shape: string; sizeId: string }> {
  await sql`
    DELETE FROM diamond_sizes s WHERE s.shape LIKE 'ZZ %'
      AND split_part(s.shape, ' ', 3) ~ '^[0-9]+$'
      AND split_part(s.shape, ' ', 3)::bigint < extract(epoch FROM now()) * 1000 - 3600000
      AND NOT EXISTS (SELECT 1 FROM lots l WHERE l.size_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM requirement_lines r WHERE r.size_id = s.id)`;
  await sql`DELETE FROM diamond_shapes d WHERE d.shape LIKE 'ZZ %'
              AND split_part(d.shape, ' ', 3) ~ '^[0-9]+$'
              AND split_part(d.shape, ' ', 3)::bigint < extract(epoch FROM now()) * 1000 - 3600000
              AND NOT EXISTS (SELECT 1 FROM diamond_sizes s WHERE s.shape = d.shape)`;
  for (;;) {
    const prefix = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
    const shape = `ZZ ${prefix} ${Date.now()}`;
    try {
      await sql`INSERT INTO diamond_shapes (shape, prefix) VALUES (${shape}, ${prefix})`;
    } catch (e) {
      if ((e as { code?: string }).code === '23505') continue; // prefix taken: draw again
      throw e;
    }
    await sql`
      INSERT INTO diamond_sizes (id, shape, min_ct, max_ct, nominal_ct, est_length_mm, est_width_mm)
      VALUES (${`${prefix}-100`}, ${shape}, 0.975, 1.025, 1, 6.4, 6.4)`;
    return { shape, sizeId: `${prefix}-100` };
  }
}
