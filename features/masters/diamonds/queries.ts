import { sql } from '@/db/client';

export type AttributeType = 'colour' | 'clarity' | 'shape' | 'lab';
export const ATTRIBUTE_TYPES: AttributeType[] = ['shape', 'colour', 'clarity', 'lab'];

export type DiamondAttribute = { id: string; value: string; sortOrder: number };

export async function getDiamondAttributes(): Promise<Record<AttributeType, DiamondAttribute[]>> {
  const rows = await sql`
    SELECT id, attribute_type, value, sort_order FROM diamond_attributes
    ORDER BY attribute_type, sort_order, value`;
  const out: Record<AttributeType, DiamondAttribute[]> = { shape: [], colour: [], clarity: [], lab: [] };
  for (const r of rows as any[]) {
    out[r.attribute_type as AttributeType].push({ id: r.id, value: r.value, sortOrder: r.sort_order });
  }
  return out;
}

/** Flat value lists for pickers -- what a purchase or memo form actually needs. */
export async function getDiamondPicklists(): Promise<Record<AttributeType, string[]>> {
  const grouped = await getDiamondAttributes();
  return {
    shape: grouped.shape.map((a) => a.value),
    colour: grouped.colour.map((a) => a.value),
    clarity: grouped.clarity.map((a) => a.value),
    lab: grouped.lab.map((a) => a.value),
  };
}
