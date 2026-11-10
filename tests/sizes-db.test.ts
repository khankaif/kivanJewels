import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';

/** The one invariant the chart exists for: within a shape, a carat points to one size. */
test('carat bands of one shape cannot overlap; a closed band holds its max', async () => {
  await inRollback(async (c) => {
    const { rows: [shape] } = await c.query(
      `INSERT INTO diamond_shapes (shape, prefix) VALUES ($1, 'ZQZ') RETURNING shape AS id`,
      [`ZZ Shape ${Date.now()}`],
    );
    const add = (id: string, min: number, max: number, nominal: number) =>
      c.query(
        `INSERT INTO diamond_sizes (id, shape, min_ct, max_ct, nominal_ct, est_length_mm, est_width_mm)
         VALUES ($1, $2, $3, $4, $5, 6.4, 6.4)`,
        [id, shape.id, min, max, nominal],
      );
    await add('ZZ-100', 0.975, 1.025, 1);
    await add('ZZ-105', 1.025, 1.075, 1.05); // touching [ ) bands do not overlap
    await assert.rejects(c.query('SAVEPOINT a').then(() => add('ZZ-101', 1.0, 1.01, 1.0)), { code: '23P01' });
    await c.query('ROLLBACK TO SAVEPOINT a');
    await add('ZZ-200', 1.975, 2, 2); // closed: holds 2.000 itself
    await assert.rejects(c.query('SAVEPOINT b').then(() => add('ZZ-X', 2, 2.5, 2.2)), { code: '23P01' });
    await c.query('ROLLBACK TO SAVEPOINT b');
    // A lot's shape must be its size's shape (composite foreign key).
    await c.query('SAVEPOINT c');
    await assert.rejects(c.query(
      `INSERT INTO lots (lot_no, stone_type, shape, size_id, source) VALUES ('ZZ-FK', 'Natural', 'Oval', 'ZZ-100', 'purchase')`,
    ), { code: '23503' });
    await c.query('ROLLBACK TO SAVEPOINT c');
    // A shape with sizes cannot be removed.
    await assert.rejects(c.query('DELETE FROM diamond_shapes WHERE shape = $1', [shape.id]), { code: '23503' });
  });
});
