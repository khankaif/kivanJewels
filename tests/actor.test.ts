import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setActorResolver, withTx } from '@/db/client';
import { recordPurchase } from '@/lib/ledger/movements';

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
class Rollback extends Error {}

/** Runs fn inside a transaction stamped with `actor`, then rolls it back. */
async function asUser(actor: string | null, fn: (c: any) => Promise<void>) {
  setActorResolver(async () => actor);
  try {
    await withTx(async (c) => { await fn(c); throw new Rollback(); });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  } finally {
    setActorResolver(async () => null);
  }
}

test('a posting is stamped with whoever was signed in', async () => {
  await asUser('user-rushabh', async (c) => {
    const { rows: [p] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Actor ${uniq()}`]);
    const lotId = await recordPurchase({
      spec: { stoneType: 'Lab Grown', shape: 'Round', sieveSize: `ZZ-${uniq()}`, mmSize: '2.20' },
      carats: 2, rate: 4000, on: '2024-06-01', partyId: p.id, billNo: `ZZ-A-${uniq()}`,
    }, c);

    const { rows: [mv] } = await c.query(
      `SELECT created_by FROM movements WHERE lot_id = $1`, [lotId]);
    const { rows: [g] } = await c.query(
      `SELECT created_by FROM ledger WHERE lot_id = $1`, [lotId]);
    assert.equal(mv.created_by, 'user-rushabh');
    assert.equal(g.created_by, 'user-rushabh', 'the money row is attributed too');
  });
});

test('with nobody signed in the row is honestly unattributed', async () => {
  await asUser(null, async (c) => {
    const { rows: [p] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`, [`ZZ Anon ${uniq()}`]);
    const lotId = await recordPurchase({
      spec: { stoneType: 'Lab Grown', shape: 'Round', sieveSize: `ZZ-${uniq()}`, mmSize: '2.20' },
      carats: 1, rate: 4000, on: '2024-06-01', partyId: p.id, billNo: `ZZ-B-${uniq()}`,
    }, c);
    const { rows: [mv] } = await c.query(
      `SELECT created_by FROM movements WHERE lot_id = $1`, [lotId]);
    assert.equal(mv.created_by, null, 'never guess who it was');
  });
});

test('the actor does not leak to the next transaction on that connection', async () => {
  await asUser('user-one', async () => {});
  // Resolver is back to null; a fresh transaction must not inherit 'user-one'.
  await asUser(null, async (c) => {
    const { rows: [r] } = await c.query(`SELECT current_setting('app.actor', true) AS a`);
    assert.ok(!r.a, 'SET LOCAL is scoped to its own transaction');
  });
});
