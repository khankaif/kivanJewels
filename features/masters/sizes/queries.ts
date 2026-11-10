import { sql } from '@/db/client';

export type Shape = {
  shape: string; prefix: string;
  lengthMm: number | null; widthMm: number | null; ratio: number | null; sizes: number;
};
export type DiamondSize = {
  id: string; shape: string;
  min_ct: number; max_ct: number; nominal_ct: number;
  lengthMm: number; widthMm: number; notes: string | null;
  /** Lots and sale lines on this size. A size in use can't be deleted. */
  used: number;
};
/** What a size picker shows: "RD-100 · Round 1.00 ct". */
export type SizeOption = { id: string; shape: string; label: string };

const n = (v: unknown) => (v === null ? null : Number(v));

/** Every shape with its prefix, 1 ct reference, L/W ratio and size count. */
export async function getShapes(): Promise<Shape[]> {
  const rows = await sql`
    SELECT d.*, (SELECT count(*)::int FROM diamond_sizes s WHERE s.shape = d.shape) AS sizes
    FROM diamond_shapes d ORDER BY d.sort_order, d.shape`;
  return (rows as any[]).map((r) => ({
    shape: r.shape, prefix: r.prefix,
    lengthMm: n(r.length_mm), widthMm: n(r.width_mm),
    ratio: r.length_mm && r.width_mm ? Number(r.length_mm) / Number(r.width_mm) : null,
    sizes: r.sizes,
  }));
}

/** The whole chart: a bounded master (a dozen shapes x a few dozen bands), so never paged. */
export async function getSizes(): Promise<DiamondSize[]> {
  const rows = await sql`
    SELECT s.*,
           (SELECT count(*) FROM lots l WHERE l.size_id = s.id)
         + (SELECT count(*) FROM requirement_lines r WHERE r.size_id = s.id) AS used
    FROM diamond_sizes s JOIN diamond_shapes d ON d.shape = s.shape
    ORDER BY d.sort_order, d.shape, s.min_ct`;
  return (rows as any[]).map((r) => ({
    id: r.id, shape: r.shape,
    min_ct: Number(r.min_ct), max_ct: Number(r.max_ct), nominal_ct: Number(r.nominal_ct),
    lengthMm: Number(r.est_length_mm), widthMm: Number(r.est_width_mm), notes: r.notes,
    used: Number(r.used),
  }));
}

export async function getSizeOptions(): Promise<SizeOption[]> {
  return (await getSizes()).map((s) => ({
    id: s.id, shape: s.shape, label: `${s.id} · ${s.shape} ${s.nominal_ct} ct`,
  }));
}
