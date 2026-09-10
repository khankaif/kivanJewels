import test from 'node:test';
import assert from 'node:assert/strict';
import { inRollback } from './helpers';
import { getPnl } from '@/features/accounts/queries';
import { sql } from '@/db/client';

const round = (n: number) => Math.round(n * 100) / 100;

test('a sale with no recorded cost is uncosted, not pure profit', async () => {
  await inRollback(async (c) => {
    const before = await getPnl(c);

    const { rows: [party] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`,
      [`ZZ Pnl Party ${Date.now()}`],
    );
    const { rows: [lot] } = await c.query(
      `INSERT INTO lots (lot_no, stone_type, source, opened_on)
       VALUES ($1,'Lab Grown','opening','2024-04-01') RETURNING id`,
      [`ZZ-PNL-${Date.now()}`],
    );
    // Opening stock: an inward adjustment, deliberately NOT a purchase.
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, moved_on) VALUES ($1,'adjust_in',5,'2024-04-01')`,
      [lot.id],
    );
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
       VALUES ($1,'sale',-5,1000,5000,'2024-04-02')`,
      [lot.id],
    );
    await c.query(
      `INSERT INTO ledger (party_id, kind, amount, dated_on) VALUES ($1,'sale_invoice',5000,'2024-04-02')`,
      [party.id],
    );

    const after = await getPnl(c);
    assert.equal(round(after.revenue - before.revenue), 5000, 'revenue must include the sale');
    assert.equal(round(after.uncosted - before.uncosted), 5000, 'it has no cost, so it is uncosted');
    assert.equal(round(after.profit - before.profit), 0, 'and it must not move profit');
  });
});

test('a sale from a purchased lot books both the revenue and its cost', async () => {
  await inRollback(async (c) => {
    const before = await getPnl(c);

    const { rows: [party] } = await c.query(
      `INSERT INTO parties (name) VALUES ($1) RETURNING id`,
      [`ZZ Pnl Party P ${Date.now()}`],
    );
    const { rows: [lot] } = await c.query(
      `INSERT INTO lots (lot_no, stone_type, cost_rate, source, opened_on)
       VALUES ($1,'Lab Grown',800,'purchase','2024-04-01') RETURNING id`,
      [`ZZ-PNL-P-${Date.now()}`],
    );
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
       VALUES ($1,'purchase',5,800,4000,'2024-04-01')`,
      [lot.id],
    );
    await c.query(
      `INSERT INTO movements (lot_id, kind, carats, rate, amount, moved_on)
       VALUES ($1,'sale',-5,1000,5000,'2024-04-02')`,
      [lot.id],
    );
    // Revenue is the invoice, not the movement: a sale with no bill behind it
    // would read as costed revenue that was never billed.
    await c.query(
      `INSERT INTO ledger (party_id, kind, amount, dated_on) VALUES ($1,'sale_invoice',5000,'2024-04-02')`,
      [party.id],
    );

    const after = await getPnl(c);
    assert.equal(round(after.revenue - before.revenue), 5000, 'the bill is the revenue');
    assert.equal(round(after.cost - before.cost), 4000, 'the purchase is cost of sales');
    assert.equal(round(after.profit - before.profit), 1000, '5000 sold less 4000 cost');
    assert.equal(round(after.uncosted - before.uncosted), 0, 'nothing uncosted here');
  });
});

test('jewellery_orders is gone', async () => {
  const rows = await sql`SELECT to_regclass('public.jewellery_orders') AS t`;
  assert.equal(rows[0].t, null);
});
