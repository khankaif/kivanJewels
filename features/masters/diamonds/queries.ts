import { sql } from '@/db/client';

/** A bucket key: 'shape', 'colour', … plus whatever the admin has added. */
export type AttributeType = string;

export type Bucket = { key: string; label: string; sortOrder: number; isPreset: boolean };
export type DiamondAttribute = {
  id: string; value: string; sortOrder: number;
  /** Shapes only: whether stones of this shape are sieved rather than measured. */
  usesSieve: boolean;
};

export async function getAttributeBuckets(): Promise<Bucket[]> {
  const rows = await sql`
    SELECT key, label, sort_order, is_preset FROM attribute_buckets
    ORDER BY sort_order, label`;
  return (rows as any[]).map((r) => ({
    key: r.key, label: r.label, sortOrder: r.sort_order, isPreset: r.is_preset,
  }));
}

export async function getDiamondAttributes(): Promise<Record<AttributeType, DiamondAttribute[]>> {
  const [buckets, rows] = await Promise.all([
    getAttributeBuckets(),
    sql`SELECT id, attribute_type, value, sort_order, uses_sieve FROM diamond_attributes
        ORDER BY attribute_type, sort_order, value`,
  ]);
  const out: Record<AttributeType, DiamondAttribute[]> = {};
  for (const b of buckets) out[b.key] = [];
  for (const r of rows as any[]) {
    (out[r.attribute_type] ??= []).push({
      id: r.id, value: r.value, sortOrder: r.sort_order, usesSieve: !!r.uses_sieve,
    });
  }
  return out;
}

/** Flat value lists for pickers -- what a purchase or memo form actually needs. */
export async function getDiamondPicklists(): Promise<Record<AttributeType, string[]>> {
  const grouped = await getDiamondAttributes();
  return Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.map((a) => a.value)]));
}

/** Shapes whose stones are sieved. The only shape-dependent rule there is. */
export async function getSieveShapes(): Promise<string[]> {
  const rows = await sql`
    SELECT value FROM diamond_attributes WHERE attribute_type = 'shape' AND uses_sieve`;
  return (rows as any[]).map((r) => r.value);
}

export type Mismatch = { bucket: string; label: string; value: string; lots: number };

/**
 * Values the book holds that the master cannot resolve -- neither a master
 * value nor a registered alias. These are the rows that would be refused on
 * the next save, so they are shown for adoption or aliasing rather than left
 * to be discovered one failed entry at a time.
 */
export async function getMasterMismatches(): Promise<Mismatch[]> {
  const rows = await sql`
    WITH used AS (
      SELECT 'stone_type' AS bucket, stone_type AS value FROM lots
      UNION ALL SELECT 'shape',   shape   FROM lots
      UNION ALL SELECT 'colour',  colour  FROM lots
      UNION ALL SELECT 'clarity', clarity FROM lots
      UNION ALL SELECT 'lab',     lab     FROM lots
      UNION ALL SELECT 'stone_type', stone_type FROM requirement_lines
      UNION ALL SELECT 'shape',   shape   FROM requirement_lines
    )
    SELECT u.bucket, u.value, count(*)::int AS lots, b.label
    FROM used u JOIN attribute_buckets b ON b.key = u.bucket
    WHERE u.value IS NOT NULL AND btrim(u.value) <> ''
      AND master_value(u.bucket, u.value) IS NULL
    GROUP BY u.bucket, u.value, b.label
    ORDER BY count(*) DESC, u.bucket, u.value`;
  return (rows as any[]).map((r) => ({
    bucket: r.bucket, label: r.label, value: r.value, lots: r.lots,
  }));
}
