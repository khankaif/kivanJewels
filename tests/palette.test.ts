import test from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { search } from '@/features/search/queries';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test('finds a party by name and links to its page', async () => {
  await inRollback(async (c) => {
    const name = `ZZ Palette Party ${uniq()}`;
    const { rows: [party] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [name]);

    const hits = await search('ZZ Palette Party', c);
    const hit = hits.find((h) => h.kind === 'party' && h.label === name);
    assert.ok(hit, 'party not found');
    assert.equal(hit.href, `/parties/${party.id}`);
  });
});

test('finds owned stock by its spec and links to the lot', async () => {
  await inRollback(async (c) => {
    const lotNo = `ZZ-PAL-${uniq()}`;
    const { rows: [lot] } = await c.query(
      `INSERT INTO lots (lot_no, stone_type, shape, sieve_size, colour, clarity,
                         cost_rate, source, opened_on)
       VALUES ($1,'Lab Grown','Zzshape','+11','EF','VS',4000,'purchase','2024-04-01')
       RETURNING id`, [lotNo]);
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
       VALUES ($1,'purchase',10,4000,40000,'2024-04-01')`, [lot.id]);

    const hits = await search('Zzshape', c);
    const hit = hits.find((h) => h.kind === 'stock');
    assert.ok(hit, 'stock unit not found');
    assert.equal(hit.href, `/stock/${lotNo}`);
  });
});

test('finds a requirement by its number', async () => {
  await inRollback(async (c) => {
    const { rows: [party] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Pal Cust ${uniq()}`]);
    const { rows: [req] } = await c.query(
      `INSERT INTO requirements (party_id, raised_on) VALUES ($1,'2024-04-01')
       RETURNING requirement_no`, [party.id]);
    await c.query(
      `INSERT INTO requirement_lines (requirement_id, sieve_size, carats)
       SELECT id, '+11', 5 FROM requirements WHERE requirement_no = $1`, [req.requirement_no]);

    const hits = await search(req.requirement_no, c);
    const hit = hits.find((h) => h.kind === 'requirement');
    assert.ok(hit, 'requirement not found');
    assert.equal(hit.href, `/sales/${req.requirement_no}`);
  });
});

test('a query that matches nothing returns nothing', async () => {
  assert.deepEqual(await search('zzzznotathingzzzz'), []);
});

test('a blank query returns nothing rather than the whole book', async () => {
  assert.deepEqual(await search('   '), []);
});
