import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';

/** The pyramid: stock stands on the master, so a rename reaches it and a delete can't pull it out. */
test('grade master: renames cascade into stock, used values cannot be deleted, no case duplicates', async () => {
  await inRollback(async (c) => {
    const name = `ZZ Colour ${Date.now()}`;
    await c.query(`INSERT INTO colours (name, code) VALUES ($1, 'ZZC')`, [name]);
    const { rows: [lot] } = await c.query(
      `INSERT INTO lots (lot_no, stone_type, colour, source) VALUES ($1, 'Lab Grown', $2, 'purchase') RETURNING id`,
      [`ZZ-GM-${Date.now()}`, name],
    );

    // Rename: the lot follows, and its unit key (generated from the colour) with it.
    await c.query(`UPDATE colours SET name = $1 WHERE name = $2`, [`${name} B`, name]);
    const { rows: [after] } = await c.query(`SELECT colour, unit_key FROM lots WHERE id = $1`, [lot.id]);
    assert.equal(after.colour, `${name} B`);
    assert.match(after.unit_key, new RegExp(`\\|${name.toUpperCase()} B\\|`));

    // In use: deleting is refused (retire it with active = false instead).
    await c.query('SAVEPOINT a');
    await assert.rejects(c.query(`DELETE FROM colours WHERE name = $1`, [`${name} B`]), { code: '23503' });
    await c.query('ROLLBACK TO SAVEPOINT a');

    // A value outside the master cannot be stored.
    await c.query('SAVEPOINT b');
    await assert.rejects(c.query(`UPDATE lots SET clarity = 'VVV-VS' WHERE id = $1`, [lot.id]), { code: '23503' });
    await c.query('ROLLBACK TO SAVEPOINT b');

    // 'ef ' beside 'EF' is the drift this prevents: names are unique ignoring case.
    await c.query('SAVEPOINT c');
    await assert.rejects(c.query(`INSERT INTO colours (name) VALUES ($1)`, [`${name} b`.toLowerCase()]), { code: '23505' });
    await c.query('ROLLBACK TO SAVEPOINT c');
  });
});
