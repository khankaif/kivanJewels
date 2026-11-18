import { sql } from '@/db/client';
import { caratsLabel, mmLabel, nominalCarats, type SavedSize, type ShapeRef } from './chart';

export type Shape = ShapeRef & { has_cut: boolean; sort_order: number; active: boolean; sizes: number };
export type DiamondSize = SavedSize & { ratio: number; nominal_ct: number };
/** What a size picker shows: "PS-4X2.5 · Pear 4 × 2.5 mm · 0.1 ct". */
export type SizeOption = { id: string; shape: string; label: string };

const num = (v: unknown) => (v === null ? null : Number(v));

/** Every shape with its code, cut rule and size count. */
export async function getShapes(): Promise<Shape[]> {
  const rows = await sql`
    SELECT d.shape, d.code, d.has_cut, d.sort_order, d.active,
           (SELECT count(*)::int FROM diamond_sizes s WHERE s.shape = d.shape) AS sizes
    FROM diamond_shapes d ORDER BY d.sort_order, d.shape`;
  return rows as Shape[];
}

const mapDiamondSize = (r: Record<string, unknown>): DiamondSize => {
  const min_ct = Number(r.min_ct);
  const max_ct = Number(r.max_ct);
  return {
    id: String(r.id), shape: String(r.shape),
    length_mm: Number(r.length_mm), width_mm: Number(r.width_mm), width2_mm: num(r.width2_mm),
    min_ct, max_ct,
    nominal_ct: nominalCarats({ min_ct, max_ct }),
    ratio: Number(r.ratio),
    active: Boolean(r.active), used: Number(r.used),
  };
};

/** The whole chart: a bounded master (a few hundred rows), so never paged. */
export async function getSizes(): Promise<DiamondSize[]> {
  const rows = await sql`
    SELECT s.*,
           (SELECT count(*) FROM lots l WHERE l.size_id = s.id)
         + (SELECT count(*) FROM requirement_lines r WHERE r.size_id = s.id)
         + (SELECT count(*) FROM diamond_prices p WHERE p.size_id = s.id) AS used
    FROM diamond_sizes s JOIN diamond_shapes d ON d.shape = s.shape
    ORDER BY d.sort_order, d.shape, s.min_ct, s.length_mm, s.width_mm`;
  return (rows as Record<string, unknown>[]).map(mapDiamondSize);
}

export type SizesPageOptions = {
  shape?: string;
  limit?: number;
  offset?: number;
};

/** Server-side paginated diamond sizes list with SQL count and offset. */
export async function getSizesPage(opts: SizesPageOptions = {}): Promise<{ rows: DiamondSize[]; total: number }> {
  const shape = opts.shape || null;
  const limit = opts.limit ?? 30;
  const offset = opts.offset ?? 0;

  const where = sql`WHERE (${shape}::text IS NULL OR s.shape = ${shape})`;

  const [countRes] = await sql`
    SELECT count(*)::int AS total FROM diamond_sizes s ${where}`;

  const rows = await sql`
    SELECT s.*,
           (SELECT count(*) FROM lots l WHERE l.size_id = s.id)
         + (SELECT count(*) FROM requirement_lines r WHERE r.size_id = s.id)
         + (SELECT count(*) FROM diamond_prices p WHERE p.size_id = s.id) AS used
    FROM diamond_sizes s JOIN diamond_shapes d ON d.shape = s.shape
    ${where}
    ORDER BY d.sort_order, d.shape, s.min_ct, s.length_mm, s.width_mm
    LIMIT ${limit} OFFSET ${offset}`;

  return {
    rows: (rows as Record<string, unknown>[]).map(mapDiamondSize),
    total: countRes ? Number(countRes.total) : 0,
  };
}

/** Active sizes for pickers. A retired size stays on its lots but leaves the list. */
export async function getSizeOptions(): Promise<SizeOption[]> {
  return (await getSizes()).filter((s) => s.active).map((s) => ({
    id: s.id, shape: s.shape, label: `${s.id} · ${s.shape} ${mmLabel(s)} · ${caratsLabel(s)}`,
  }));
}
