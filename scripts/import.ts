/**
 * Imports ref/initial_data.json into the movements/ledger schema.
 *
 * Bulk-loads via UNNEST: one round trip per table rather than one per row
 * (~8,000 statements otherwise). Positive movements are inserted before
 * negative ones so the overdraw trigger never sees a sale before its purchase.
 *
 * Re-running requires --reset, which truncates every imported table.
 */
import { readFileSync } from 'node:fs';
import { sql, withTx, type PoolClientLike } from '../db/client';
import { parseLooseDate } from '../lib/dates';
import { partyKey, resolveParties } from '../lib/normalize';

type Row = Record<string, any>;

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '' || v === ' ') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clean = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return !s || s === 'None' || s === '-' ? null : s;
};

const FALLBACK_DATE = '2024-04-01';
// Money with no resolvable counterparty lands here rather than being dropped.
// Visible by name so the data-quality gap is obvious in every party report.
const UNIDENTIFIED = '(Unidentified)';

export type ImportReport = {
  parties: number;
  lots: number;
  movements: number;
  ledgerRows: number;
  jewelleryOrders: number;
  skipped: string[];
  plugs: string[];
};

type LotIn = {
  lot_no: string; party_id: string | null; stone_type: string;
  shape: string | null; sieve_size: string | null; mm_size: string | null;
  clarity: string | null; colour: string | null; cost_rate: number | null;
  source: string; opened_on: string;
};
type MoveIn = {
  lot_no: string; kind: string; carats: number; rate: number | null;
  amount: number | null; ref_type: string; ref_id: string; moved_on: string;
  notes: string | null;
};
type LedgerIn = {
  party_id: string; kind: string; amount: number; dated_on: string;
  ref_type: string; ref_id: string; notes: string | null;
};

export async function importAll(reset = false): Promise<ImportReport> {
  const data = JSON.parse(readFileSync('ref/initial_data.json', 'utf8'));
  const dh: Row[] = data.diamond_hisab;
  const ks: Row[] = data.kaivan_stock;
  const jm: Row[] = data.jewellery_master;
  const skipped: string[] = [];

  const [{ n: existing }] = await sql`SELECT count(*)::int AS n FROM lots`;
  if (existing > 0 && !reset) {
    throw new Error(`lots already holds ${existing} rows. Re-run with --reset to truncate and reimport.`);
  }
  if (reset) {
    await sql`TRUNCATE ledger, memo_line_billings, movements, memo_lines, memos,
                       lots, jewellery_orders, parties RESTART IDENTITY CASCADE`;
  }

  // ---- 1. parties -------------------------------------------------------
  const rawNames = [
    ...dh.map((r) => r['Pur. Party']),
    ...dh.map((r) => r['Party Name']),
    ...ks.map((r) => r['Party Name']),
    ...jm.map((r) => r['Cust Name']),
    ...jm.map((r) => r['Purchase Party']),
  ];
  const resolved = resolveParties(rawNames); // key -> display name
  const names = [...new Set([...resolved.values(), UNIDENTIFIED])];

  await sql`INSERT INTO parties (name) SELECT * FROM UNNEST(${names}::text[])
            ON CONFLICT (name) DO NOTHING`;
  const partyRows = await sql`SELECT id, name FROM parties`;
  const idByName = new Map<string, string>(partyRows.map((r: any) => [r.name, r.id]));
  const idFor = (raw: unknown): string | null => {
    const s = clean(raw);
    if (!s) return null;
    const display = resolved.get(partyKey(s));
    return display ? idByName.get(display) ?? null : null;
  };

  // ---- 2. build lots / movements / ledger in memory ----------------------
  const lots: LotIn[] = [];
  const moves: MoveIn[] = [];
  const ledger: LedgerIn[] = [];

  for (const r of dh) {
    const carats = round3(num(r['Carats']));
    // A row can be a real sale with no carat weight: DH-7 is 107 pcs of CZ,
    // sold by the piece. No stone lot or movement, but the money still posts.
    const hasStone = carats > 0;
    if (!hasStone) skipped.push(`${r._id}: no carat weight (money imported, no stock lot)`);

    const purParty = clean(r['Pur. Party']);
    const isSelfLot = purParty === 'Kaivan Stock';
    const purDate = parseLooseDate(r['Pur. Date']) ?? parseLooseDate(r['Order Date']) ?? FALLBACK_DATE;
    const saleDate = parseLooseDate(r['Order Date']) ?? purDate;
    const lotNo = `DH-${r._id}`;

    if (hasStone) lots.push({
      lot_no: lotNo,
      party_id: isSelfLot ? null : idFor(purParty),
      stone_type: clean(r['Diamond Type']) ?? 'Unknown',
      shape: clean(r['Shape']),
      sieve_size: clean(r['Sieve Size']),
      mm_size: clean(r['MM Size']),
      clarity: clean(r['Clarity']),
      colour: clean(r['Colour']),
      cost_rate: num(r['Pur. Rate']) || null,
      source: isSelfLot ? 'legacy_selflot' : 'purchase',
      opened_on: purDate,
    });

    // carat ledger. Amount is authoritative, not carats x rate: 7 source rows disagree.
    const purAmt = num(r['Pur. Amt']);
    if (hasStone && purAmt > 0) {
      moves.push({ lot_no: lotNo, kind: 'purchase', carats, rate: num(r['Pur. Rate']) || null,
        amount: purAmt, ref_type: 'diamond_hisab', ref_id: r._id, moved_on: purDate, notes: null });
    } else if (hasStone) {
      moves.push({ lot_no: lotNo, kind: 'adjust_in', carats, rate: null, amount: null,
        ref_type: 'diamond_hisab', ref_id: r._id, moved_on: purDate,
        notes: 'opening: no purchase side in source' });
    }

    const saleAmt = num(r['Sale Amt']);
    if (hasStone && saleAmt > 0) {
      moves.push({ lot_no: lotNo, kind: 'sale', carats: -carats, rate: num(r['Sale Rate']) || null,
        amount: saleAmt, ref_type: 'diamond_hisab', ref_id: r._id, moved_on: saleDate, notes: null });
    }

    // money ledger
    let supplierId = isSelfLot ? null : idFor(purParty);
    if (!isSelfLot && purAmt > 0 && !supplierId) {
      supplierId = idByName.get(UNIDENTIFIED)!;
      skipped.push(`${r._id}: purchase of ${purAmt} has no counterparty in source -> ${UNIDENTIFIED}`);
    }
    if (purAmt > 0 && supplierId) {
      ledger.push({ party_id: supplierId, kind: 'purchase_invoice', amount: -purAmt,
        dated_on: purDate, ref_type: 'diamond_hisab', ref_id: r._id, notes: null });
      const paid = num(r['Pay. Paid']);
      if (paid > 0) {
        ledger.push({ party_id: supplierId, kind: 'payment_out', amount: paid,
          dated_on: parseLooseDate(r['Payment Date']) ?? purDate,
          ref_type: 'diamond_hisab', ref_id: r._id, notes: 'imported aggregate payment' });
      }
    }

    let clientId = idFor(r['Party Name']);
    if (saleAmt > 0 && !clientId) {
      clientId = idByName.get(UNIDENTIFIED)!;
      skipped.push(`${r._id}: sale of ${saleAmt} has no counterparty in source -> ${UNIDENTIFIED}`);
    }
    if (saleAmt > 0 && clientId) {
      ledger.push({ party_id: clientId, kind: 'sale_invoice', amount: saleAmt,
        dated_on: saleDate, ref_type: 'diamond_hisab', ref_id: r._id, notes: null });
      const recd = num(r['Sale Amt Paid']);
      if (recd > 0) {
        ledger.push({ party_id: clientId, kind: 'payment_in', amount: -recd,
          dated_on: parseLooseDate(r['Payment Date_1']) ?? saleDate,
          ref_type: 'diamond_hisab', ref_id: r._id, notes: 'imported aggregate receipt' });
      }
    }
  }

  // kaivan_stock: 30 internally consistent lots (Carats - Used = Balance, 0 mismatches)
  for (const r of ks) {
    const carats = round3(num(r['Carats']));
    if (carats <= 0) { skipped.push(`${r._id}: kaivan lot with no carats`); continue; }
    const rate = num(r['Rate']) || null;
    const lotNo = `KS-${r._id}`;
    lots.push({
      lot_no: lotNo, party_id: idFor(r['Party Name']),
      stone_type: clean(r['Stone Type']) ?? 'Lab Grown',
      shape: clean(r['Shape']), sieve_size: clean(r['Seive Size']), mm_size: clean(r['MM']),
      clarity: null, colour: null, cost_rate: rate, source: 'opening', opened_on: FALLBACK_DATE,
    });
    moves.push({ lot_no: lotNo, kind: 'purchase', carats, rate, amount: num(r['Total Rs']),
      ref_type: 'kaivan_stock', ref_id: r._id, moved_on: FALLBACK_DATE, notes: null });
    const used = round3(num(r['Stock Used']));
    if (used > 0) {
      moves.push({ lot_no: lotNo, kind: 'consumed_jewellery', carats: -used, rate,
        amount: round2(used * (rate ?? 0)), ref_type: 'kaivan_stock', ref_id: r._id,
        moved_on: FALLBACK_DATE, notes: 'imported aggregate consumption' });
    }
  }

  // ---- 2b. reconciliation plugs -------------------------------------------
  // The source can record consuming more than a lot ever held (kaivan_stock
  // Sr.23: Carats 0.43, Used 0.46, Balance -0.03). A negative physical balance
  // is impossible, so post an explicit, queryable plug rather than either
  // silently capping consumption or letting the overdraw guard reject the row.
  // Tagged ref_type='reconciliation' so it never pollutes source-total checks.
  const netByLot = new Map<string, number>();
  for (const m of moves) netByLot.set(m.lot_no, (netByLot.get(m.lot_no) ?? 0) + m.carats);
  const plugs: string[] = [];
  for (const [lotNo, net] of netByLot) {
    if (net < -0.0005) {
      const shortfall = round3(-net);
      moves.unshift({
        lot_no: lotNo, kind: 'adjust_in', carats: shortfall, rate: null, amount: null,
        ref_type: 'reconciliation', ref_id: lotNo, moved_on: FALLBACK_DATE,
        notes: `unreconciled: source consumption exceeds lot by ${shortfall} ct`,
      });
      plugs.push(`${lotNo}: +${shortfall} ct plug (source balance was ${round3(net)})`);
    }
  }

  // ---- 3. bulk insert ----------------------------------------------------
  const lotIdByNo = new Map<string, string>();
  let movementCount = 0;
  let ledgerCount = 0;
  let jewelleryCount = 0;

  await withTx(async (tx: PoolClientLike) => {
    const col = <K extends keyof LotIn>(k: K) => lots.map((l) => l[k]);
    const { rows: lotRows } = await tx.query(
      `INSERT INTO lots (lot_no, party_id, stone_type, shape, sieve_size, mm_size,
                         clarity, colour, cost_rate, source, opened_on)
       SELECT * FROM UNNEST($1::text[], $2::uuid[], $3::text[], $4::text[], $5::text[],
                            $6::text[], $7::text[], $8::text[], $9::numeric[], $10::text[], $11::date[])
       RETURNING id, lot_no`,
      [col('lot_no'), col('party_id'), col('stone_type'), col('shape'), col('sieve_size'),
       col('mm_size'), col('clarity'), col('colour'), col('cost_rate'), col('source'), col('opened_on')],
    );
    for (const r of lotRows) lotIdByNo.set(r.lot_no, r.id);

    // Positives first: the overdraw trigger must never see a sale before its purchase.
    for (const group of [moves.filter((m) => m.carats > 0), moves.filter((m) => m.carats < 0)]) {
      if (!group.length) continue;
      const mc = <K extends keyof MoveIn>(k: K) => group.map((m) => m[k]);
      await tx.query(
        `INSERT INTO movements (lot_id, kind, carats, rate, amount, ref_type, ref_id, moved_on, notes)
         SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::numeric[], $4::numeric[],
                              $5::numeric[], $6::text[], $7::text[], $8::date[], $9::text[])`,
        [group.map((m) => lotIdByNo.get(m.lot_no)!), mc('kind'), mc('carats'), mc('rate'),
         mc('amount'), mc('ref_type'), mc('ref_id'), mc('moved_on'), mc('notes')],
      );
      movementCount += group.length;
    }

    if (ledger.length) {
      const gc = <K extends keyof LedgerIn>(k: K) => ledger.map((g) => g[k]);
      await tx.query(
        `INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id, notes)
         SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::numeric[], $4::date[],
                              $5::text[], $6::text[], $7::text[])`,
        [gc('party_id'), gc('kind'), gc('amount'), gc('dated_on'), gc('ref_type'), gc('ref_id'), gc('notes')],
      );
      ledgerCount = ledger.length;
    }

    // jewellery orders + their client receivables
    for (const r of jm) {
      // Two source rows are annotations, not orders: Cust Order No holds the
      // literal text "Adjusted Against Diamonds" with no customer, product or
      // amount. Identify them by absence of content, not by that exact string.
      const isAnnotation =
        !clean(r['Cust Name']) && !clean(r['Product type']) && num(r['Client Total']) === 0;
      if (isAnnotation) {
        skipped.push(`${r._id}: not an order (no customer, product or amount) - skipped`);
        continue;
      }
      // A real order can lack an order number (JM-29: Karan, Screw Bck, Rs 1,645
      // fully paid). Synthesise one rather than dropping the order.
      const orderNo = clean(r['Cust Order No']) ?? `JM-${r._id}`;
      if (!clean(r['Cust Order No'])) {
        skipped.push(`${r._id}: no order number in source -> synthesised ${orderNo}`);
      }
      const on = parseLooseDate(r['Date']);
      await tx.query(
        `INSERT INTO jewellery_orders (order_no, ordered_on, party_id, product_type, metal_type,
           metal_colour, gross_wt, net_wt, metal_rate, metal_amount, labour_amount,
           other_charges, client_total, product_cost, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (order_no) DO NOTHING`,
        [orderNo, on, idFor(r['Cust Name']), clean(r['Product type']),
         clean(r['Metal Type'])?.replace(/\s+/g, '') ?? null, clean(r['Metal Colour']),
         num(r['Gross Wt']) || null, num(r['Net Wt']) || null, num(r['Metal Rate']) || null,
         round2(num(r['Metal Amt'])) || null, round2(num(r['Lab Charges'])) || null,
         round2(num(r['Hm & Engr']) + num(r['Cad Charges'])) || null,
         num(r['Client Total']) || null,
         // Source "Product Costing"; falls back to Metal Total when absent.
         num(r['Product Costing']) || num(r['Metal Total']) || null,
         clean(r['Remarks'])],
      );
      jewelleryCount++;

      const clientId = idFor(r['Cust Name']);
      const total = num(r['Client Total']);
      if (clientId && total > 0) {
        const d = on ?? FALLBACK_DATE;
        await tx.query(
          `INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id)
           VALUES ($1,'sale_invoice',$2,$3,'jewellery',$4)`,
          [clientId, total, d, orderNo]);
        ledgerCount++;
        const recd = num(r['Payment status from client']);
        if (recd > 0) {
          await tx.query(
            `INSERT INTO ledger (party_id, kind, amount, dated_on, ref_type, ref_id, notes)
             VALUES ($1,'payment_in',$2,$3,'jewellery',$4,'imported aggregate receipt')`,
            [clientId, -recd, parseLooseDate(r['Amt Rec Date']) ?? d, orderNo]);
          ledgerCount++;
        }
      }
    }
  });

  return {
    parties: resolved.size, lots: lots.length, movements: movementCount,
    ledgerRows: ledgerCount, jewelleryOrders: jewelleryCount, skipped, plugs,
  };
}

if (process.argv[1]?.includes('import')) {
  importAll(process.argv.includes('--reset'))
    .then((rep) => {
      console.log({ ...rep, skipped: rep.skipped.length, plugs: rep.plugs.length });
      if (rep.plugs.length) {
        console.log('\nreconciliation plugs (source consumed more than the lot held):');
        for (const p of rep.plugs) console.log('  -', p);
      }
      if (rep.skipped.length) {
        console.log('\nskipped rows:');
        for (const s of rep.skipped.slice(0, 20)) console.log('  -', s);
        if (rep.skipped.length > 20) console.log(`  ... and ${rep.skipped.length - 20} more`);
      }
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
