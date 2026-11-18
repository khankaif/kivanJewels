import { sql } from '@/db/client';
import { CERTIFIED, type Grades } from '@/lib/spec-rules';

/** The lists Masters -> Grades manages. Order = the page's order. */
export const LISTS = {
  stone_types:   { label: 'Stone type',            hint: 'Natural, Lab Grown, Colour Stone…' },
  colours:       { label: 'Colour',                hint: 'Single grades (E), parcel ranges (EF) and fancy colours.' },
  clarities:     { label: 'Clarity',               hint: 'Single grades (VS1) and parcel ranges (VS-SI).' },
  fluorescences: { label: 'Fluorescence',          hint: 'Best to weakest.' },
  finish_grades: { label: 'Cut, polish & symmetry', hint: 'One scale for all three. Cut applies to shapes marked “has cut”.' },
  labs:          { label: 'Certificate lab',       hint: 'Labs that certify stones.' },
} as const;
export type ListName = keyof typeof LISTS;
export const isList = (t: string): t is ListName => Object.hasOwn(LISTS, t);

export type GradeRow = {
  name: string; code: string | null; sort_order: number; active: boolean;
  /** Records on this value: stock, sale lines, catalog items, quality options, prices. In use = can't be deleted. */
  used: number;
};

/**
 * The grade master's values, one round trip for all four lists.
 *
 * Pickers get active values only: a retired value leaves every picker. Checks
 * pass `{ retired: true }`, so a parcel already on a retired grade can still
 * be sold or billed -- retiring stops new use, it does not strand stock.
 */
export async function getGrades({ retired = false } = {}): Promise<Grades> {
  const rows = (await sql`
    SELECT 'stoneType' AS f, name, code, sort_order FROM stone_types WHERE active OR ${retired}
    UNION ALL SELECT 'colour',  name, code, sort_order FROM colours   WHERE active OR ${retired}
    UNION ALL SELECT 'clarity', name, code, sort_order FROM clarities WHERE active OR ${retired}
    UNION ALL SELECT 'lab',     name, code, sort_order FROM labs      WHERE active OR ${retired}
    ORDER BY 1, 4, 2`) as { f: keyof Grades; name: string; code: string | null }[];
  const out: Grades = { stoneType: [], colour: [], clarity: [], lab: [], certified: CERTIFIED };
  for (const r of rows) out[r.f].push({ name: r.name, code: r.code });
  return out;
}

/** How many records use each value, so the page can say what a delete would break. */
const USAGE: Partial<Record<ListName, string>> = {
  stone_types: `(SELECT count(*) FROM lots WHERE stone_type = v.name)
              + (SELECT count(*) FROM requirement_lines WHERE stone_type = v.name)
              + (SELECT count(*) FROM catalog_items WHERE stone_type = v.name)
              + (SELECT count(*) FROM stone_subtypes WHERE stone_type = v.name)
              + (SELECT count(*) FROM diamond_prices WHERE stone_type = v.name)`,
  colours:   `(SELECT count(*) FROM lots WHERE colour = v.name) + (SELECT count(*) FROM requirement_lines WHERE colour = v.name)
            + (SELECT count(*) FROM quality_options WHERE colour = v.name)`,
  clarities: `(SELECT count(*) FROM lots WHERE clarity = v.name) + (SELECT count(*) FROM requirement_lines WHERE clarity = v.name)
            + (SELECT count(*) FROM quality_options WHERE clarity = v.name)`,
  labs:      `(SELECT count(*) FROM lots WHERE lab = v.name) + (SELECT count(*) FROM requirement_lines WHERE lab = v.name)`,
};

/** Every list, retired values included, for the master page. */
export async function getGradeLists(): Promise<Record<ListName, GradeRow[]>> {
  const names = Object.keys(LISTS) as ListName[];
  const lists = await Promise.all(names.map((t) =>
    // t is a key of LISTS, never user input, so naming the table is safe.
    sql.query(`SELECT v.name, v.code, v.sort_order, v.active, ${USAGE[t] ?? '0'} AS used
               FROM ${t} v ORDER BY v.sort_order, v.name`),
  ));
  return Object.fromEntries(names.map((t, i) => [
    t, (lists[i] as GradeRow[]).map((r) => ({ ...r, used: Number(r.used) })),
  ])) as Record<ListName, GradeRow[]>;
}
