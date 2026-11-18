import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';

/** Prices stand on the masters: renames reach them, and nothing priced can be deleted out from under them. */
test('prices: one per stone type, size and quality; masters renames cascade; priced rows are protected', async () => {
  await inRollback(async (c) => {
    const id = Date.now();
    await c.query(`INSERT INTO colours (name) VALUES ($1)`, [`ZZ C ${id}`]);
    await c.query(`INSERT INTO diamond_shapes (shape, code) VALUES ($1, 'ZQPZ')`, [`ZZ P ${id}`]);
    await c.query(`INSERT INTO diamond_sizes (id, shape, length_mm, width_mm, min_ct, max_ct) VALUES ('ZQPZ-1', $1, 1, 1, 0.005, 0.005)`, [`ZZ P ${id}`]);
    await c.query(`INSERT INTO quality_options (colour, clarity) VALUES ($1, 'VVS-VS')`, [`ZZ C ${id}`]);
    const price = (n: number) => c.query(
      `INSERT INTO diamond_prices (stone_type, size_id, colour, clarity, price_per_ct) VALUES ('Lab Grown', 'ZQPZ-1', $1, 'VVS-VS', $2)`,
      [`ZZ C ${id}`, n]);
    await price(15000);

    await c.query('SAVEPOINT a');
    await assert.rejects(price(16000), { code: '23505' }, 'a second price for the same cell');
    await c.query('ROLLBACK TO SAVEPOINT a');
    await c.query('SAVEPOINT b');
    await assert.rejects(c.query(`UPDATE diamond_prices SET price_per_ct = 0 WHERE size_id = 'ZQPZ-1'`), { code: '23514' });
    await c.query('ROLLBACK TO SAVEPOINT b');

    // Renaming the colour in the grade master renames the quality and its price.
    await c.query(`UPDATE colours SET name = $1 WHERE name = $2`, [`ZZ C ${id} B`, `ZZ C ${id}`]);
    const { rows: [p] } = await c.query(`SELECT colour FROM diamond_prices WHERE size_id = 'ZQPZ-1'`);
    assert.equal(p.colour, `ZZ C ${id} B`);
    // Renaming a Size ID follows into its prices.
    await c.query(`UPDATE diamond_sizes SET id = 'ZQPZ-1B' WHERE id = 'ZQPZ-1'`);
    assert.equal((await c.query(`SELECT count(*)::int n FROM diamond_prices WHERE size_id = 'ZQPZ-1B'`)).rows[0].n, 1);

    // A priced size or quality cannot be deleted.
    await c.query('SAVEPOINT c');
    await assert.rejects(c.query(`DELETE FROM diamond_sizes WHERE id = 'ZQPZ-1B'`), { code: '23503' });
    await c.query('ROLLBACK TO SAVEPOINT c');
    await c.query('SAVEPOINT d');
    await assert.rejects(c.query(`DELETE FROM quality_options WHERE colour = $1`, [`ZZ C ${id} B`]), { code: '23503' });
    await c.query('ROLLBACK TO SAVEPOINT d');
  });
});
