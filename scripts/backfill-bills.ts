/**
 * Backfills ledger.bill_no from the source workbook.
 *
 * Non-destructive: it only UPDATEs bill_no on rows the import created, matched
 * by (ref_type, ref_id, kind). Nothing created in the app is touched.
 *
 *   "Bill No." -> our sale bill      (sale_invoice / payment_in)
 *   "Mode"     -> supplier's bill    (purchase_invoice / payment_out)
 */
import { readFileSync } from 'node:fs';
import { withTx, sql } from '../db/client';

const clean = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return !s || s === 'None' || s === '-' ? null : s;
};

async function main() {
  const data = JSON.parse(readFileSync('ref/initial_data.json', 'utf8'));
  const sale: [string, string][] = [];
  const pur: [string, string][] = [];

  for (const r of data.diamond_hisab as any[]) {
    const b = clean(r['Bill No.']);
    if (b) sale.push([r._id, b]);
    const m = clean(r['Mode']);
    if (m) pur.push([r._id, m]);
  }
  for (const r of data.jewellery_master as any[]) {
    const o = clean(r['Cust Order No']) ?? `JM-${r._id}`;
    sale.push([o, o]);
  }

  let updated = 0;
  await withTx(async (tx) => {
    for (const [kinds, pairs, refTypes] of [
      [['sale_invoice', 'payment_in'], sale, ['diamond_hisab', 'jewellery']],
      [['purchase_invoice', 'payment_out'], pur, ['diamond_hisab']],
    ] as const) {
      if (!pairs.length) continue;
      const res = await tx.query(
        `UPDATE ledger g SET bill_no = v.bill_no
         FROM (SELECT * FROM UNNEST($1::text[], $2::text[]) AS t(ref_id, bill_no)) v
         WHERE g.ref_id = v.ref_id
           AND g.kind = ANY($3::text[])
           AND g.ref_type = ANY($4::text[])`,
        [pairs.map((p) => p[0]), pairs.map((p) => p[1]), kinds as unknown as string[],
         refTypes as unknown as string[]],
      );
      updated += (res as any).rowCount ?? 0;
    }
  });

  const [b] = await sql`SELECT count(*)::int n FROM bills`;
  const [named] = await sql`
    SELECT count(*)::int n FROM bills WHERE bill_no IS NOT NULL`;
  console.log(`bill_no set on ${updated} ledger rows`);
  console.log(`bills view: ${b.n} documents, ${named.n} with a real bill number`);
}

main().catch((e) => { console.error(e); process.exit(1); });
