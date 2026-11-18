// Price grid rules, pure. Tested in tests/prices.test.ts.

export type Quality = { colour: string; clarity: string; active: boolean };
export type PriceKey = { stone_type: string; size_id: string; colour: string; clarity: string };
export type Price = PriceKey & { price_per_ct: number };

/** "EF VVS-VS": the column header and what a shopper sees. */
export const qualityLabel = (q: Pick<Quality, 'colour' | 'clarity'>) => `${q.colour} ${q.clarity}`;
export const priceKey = (k: PriceKey) => `${k.stone_type}|${k.size_id}|${k.colour}|${k.clarity}`;

/** Columns that say which row it is, then context the import ignores; every other column is a quality. */
export const KEY_COLUMNS = ['stone_type', 'size_id'] as const;
export const INFO_COLUMNS = ['shape', 'mm', 'carats'] as const;

/** "15,750", "₹ 15750", "15750.00" -> 15750. Blank -> null (no price). Anything else -> NaN. */
export function parsePrice(raw: string | undefined): number | null {
  const t = String(raw ?? '').replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 1e10 ? Math.round(n * 100) / 100 : NaN;
}

export type PricePlan = {
  set: (Price & { before: number | null })[];
  remove: (PriceKey & { before: number })[];
  unchanged: number;
  errors: string[];
};

/**
 * What importing a price grid would change, without changing it.
 *
 * Every cell in the file is the truth for its stone type, size and quality: a
 * number sets the price, a blank removes it. Anything the file does not have
 * -- another stone type, a size it leaves out, a quality with no column -- is
 * kept, so a file of only Lab Grown rows never wipes the Natural prices.
 */
export function planPrices(
  header: string[],
  rows: string[][],
  ctx: {
    stoneTypes: { name: string; code: string | null }[];
    sizeIds: Set<string>;
    qualities: Quality[];
    saved: Map<string, number>;
  },
): PricePlan {
  const plan: PricePlan = { set: [], remove: [], unchanged: 0, errors: [] };
  const cols = header.map((h) => h.trim().replace(/\s+/g, ' '));
  const lower = cols.map((c) => c.toLowerCase());
  const at = (name: string) => lower.indexOf(name);
  for (const k of KEY_COLUMNS) if (at(k) < 0) plan.errors.push(`The file needs a ${k} column. Use the columns of Export.`);

  // Each remaining header must be an active quality, matched exactly ignoring case.
  const priced: { index: number; q: Quality }[] = [];
  cols.forEach((c, index) => {
    if (!c || ([...KEY_COLUMNS, ...INFO_COLUMNS] as string[]).includes(lower[index])) return;
    const q = ctx.qualities.find((x) => qualityLabel(x).toLowerCase() === lower[index]);
    if (!q) plan.errors.push(`Column "${c}" is not a quality option. Add it under Quality options, or fix the header.`);
    else if (!q.active) plan.errors.push(`Column "${c}" is a retired quality; reactivate it or drop the column.`);
    else priced.push({ index, q });
  });
  if (plan.errors.length) return plan;
  if (!priced.length) return { ...plan, errors: ['The file has no quality columns (e.g. "EF VVS-VS").'] };

  const seen = new Map<string, number>();
  rows.forEach((cells, i) => {
    const line = i + 2; // the row number the owner sees in Excel
    const typeRaw = String(cells[at('stone_type')] ?? '').trim().toLowerCase();
    const type = ctx.stoneTypes.find((t) => t.name.toLowerCase() === typeRaw || t.code?.toLowerCase() === typeRaw);
    if (!type) return void plan.errors.push(`Row ${line}: "${cells[at('stone_type')] ?? ''}" is not a stone type in the master.`);
    const size_id = String(cells[at('size_id')] ?? '').trim().toUpperCase();
    if (!ctx.sizeIds.has(size_id)) return void plan.errors.push(`Row ${line}: no size ${size_id || '(blank)'} in the size chart.`);
    const rowKey = `${type.name}|${size_id}`;
    if (seen.has(rowKey)) return void plan.errors.push(`Row ${line}: ${type.name} ${size_id} is already on row ${seen.get(rowKey)}.`);
    seen.set(rowKey, line);

    for (const { index, q } of priced) {
      const price = parsePrice(cells[index]);
      const key = { stone_type: type.name, size_id, colour: q.colour, clarity: q.clarity };
      const before = ctx.saved.get(priceKey(key)) ?? null;
      if (Number.isNaN(price)) {
        plan.errors.push(`Row ${line}, ${qualityLabel(q)}: "${cells[index]}" is not a price.`);
      } else if (price === null) {
        if (before !== null) plan.remove.push({ ...key, before });
      } else if (price === before) plan.unchanged++;
      else plan.set.push({ ...key, price_per_ct: price, before });
    }
  });
  return plan;
}
