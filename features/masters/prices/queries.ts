import { sql } from '@/db/client';
import { caratsLabel, mmLabel } from '@/features/masters/sizes/chart';
import { getSizes } from '@/features/masters/sizes/queries';
import { priceKey, qualityLabel, type Quality } from './grid';

export type QualityRow = Quality & { sort_order: number; prices: number };

/** Quality options in grid order, with how many prices each holds. */
export async function getQualities(): Promise<QualityRow[]> {
  const rows = await sql`
    SELECT q.*, (SELECT count(*)::int FROM diamond_prices p
                 WHERE p.colour = q.colour AND p.clarity = q.clarity) AS prices
    FROM quality_options q ORDER BY q.sort_order, q.colour, q.clarity`;
  return rows as QualityRow[];
}

/** Every saved price as key -> rupees per carat. A few thousand rows at most. */
export async function getPriceMap(): Promise<Map<string, number>> {
  const rows = await sql`SELECT stone_type, size_id, colour, clarity, price_per_ct FROM diamond_prices`;
  return new Map((rows as Record<string, string>[]).map((r) => [
    priceKey({ stone_type: r.stone_type, size_id: r.size_id, colour: r.colour, clarity: r.clarity }),
    Number(r.price_per_ct),
  ]));
}

/** How many prices each stone type has, for the page's tabs. */
export async function getPricedTypes(): Promise<Map<string, number>> {
  const rows = await sql`SELECT stone_type, count(*)::int AS n FROM diamond_prices GROUP BY 1`;
  return new Map((rows as { stone_type: string; n: number }[]).map((r) => [r.stone_type, r.n]));
}

/**
 * One stone type's grid: every active size, one cell per active quality. The
 * same rows are the page's table and the CSV the import reads back.
 */
export async function getPriceGrid(stoneType: string) {
  const [sizes, qualities, prices] = await Promise.all([getSizes(), getQualities(), getPriceMap()]);
  const cols = qualities.filter((q) => q.active);
  const rows = sizes.filter((s) => s.active).map((s) => ({
    size: s,
    cells: cols.map((q) => prices.get(priceKey({ stone_type: stoneType, size_id: s.id, colour: q.colour, clarity: q.clarity })) ?? null),
  }));
  return { qualities: cols, rows };
}

/** The grid as CSV rows: key columns, read-only context, then one column per quality. */
export async function getPriceCsv(stoneType: string) {
  const { qualities, rows } = await getPriceGrid(stoneType);
  const qcols = qualities.map(qualityLabel);
  return {
    cols: ['stone_type', 'size_id', 'shape', 'mm', 'carats', ...qcols],
    rows: rows.map(({ size, cells }) => ({
      stone_type: stoneType, size_id: size.id, shape: size.shape, mm: mmLabel(size), carats: caratsLabel(size),
      ...Object.fromEntries(qcols.map((c, i) => [c, cells[i] ?? ''])),
    })),
  };
}
