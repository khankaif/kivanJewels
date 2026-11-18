import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';

/** What the database itself holds the chart to, whatever the app sends. */
test('size chart: one row per size, a lot keeps its size’s shape, used shapes stay', async () => {
  await inRollback(async (c) => {
    const { rows: [shape] } = await c.query(
      `INSERT INTO diamond_shapes (shape, code) VALUES ($1, 'ZQZQ') RETURNING shape AS id`,
      [`ZZ Shape ${Date.now()}`],
    );
    const add = (id: string, l: number, w: number, min: number, max = min) =>
      c.query(
        `INSERT INTO diamond_sizes (id, shape, length_mm, width_mm, min_ct, max_ct) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, shape.id, l, w, min, max],
      );
    await add('ZQZQ-5.3', 5.3, 5.3, 0.75);
    await add('ZQZQ-5.3-0.8', 5.3, 5.3, 0.8); // same mm, another weight: a different size
    const { rows: [r] } = await c.query(`SELECT ratio FROM diamond_sizes WHERE id = 'ZQZQ-5.3'`);
    assert.equal(Number(r.ratio), 1, 'ratio is computed, never typed');

    await c.query('SAVEPOINT a');
    await assert.rejects(add('ZQZQ-DUP', 5.3, 5.3, 0.75), { code: '23505' }, 'the same size twice');
    await c.query('ROLLBACK TO SAVEPOINT a');
    await c.query('SAVEPOINT b');
    await assert.rejects(add('ZQZQ-BACK', 4, 3, 0.2, 0.1), { code: '23514' }, 'max below min');
    await c.query('ROLLBACK TO SAVEPOINT b');

    // A lot's shape must be its size's shape (composite foreign key).
    await c.query('SAVEPOINT c');
    await assert.rejects(c.query(
      `INSERT INTO lots (lot_no, stone_type, shape, size_id, source) VALUES ('ZZ-FK', 'Natural', 'Oval', 'ZQZQ-5.3', 'purchase')`,
    ), { code: '23503' });
    await c.query('ROLLBACK TO SAVEPOINT c');

    // Renaming the shape carries into its sizes and their lots.
    await c.query(
      `INSERT INTO lots (lot_no, stone_type, shape, size_id, source) VALUES ('ZZ-SZ', 'Natural', $1, 'ZQZQ-5.3', 'purchase')`,
      [shape.id],
    );
    await c.query(`UPDATE diamond_shapes SET shape = $1 WHERE shape = $2`, [`${shape.id} B`, shape.id]);
    const { rows: [lot] } = await c.query(`SELECT shape FROM lots WHERE lot_no = 'ZZ-SZ'`);
    assert.equal(lot.shape, `${shape.id} B`);

    // A shape with sizes cannot be removed.
    await assert.rejects(c.query('DELETE FROM diamond_shapes WHERE shape = $1', [`${shape.id} B`]), { code: '23503' });
  });
});
