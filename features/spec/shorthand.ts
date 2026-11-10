import { sql } from '@/db/client';
import { GRADES, gradeValue, type GradeField, type SpecField } from '@/lib/spec-rules';

export type Shorthand = {
  spec: Partial<Record<SpecField, string>>;
  carats: number | null;
  rate: number | null;
  /** Words nothing recognised, shown back so a typo is visible, not silently dropped. */
  unknown: string[];
};

const RATE = /^@([\d,]+(?:\.\d+)?)$/;
const CARATS = /^(\d+(?:\.\d+)?)(?:ct|cts)?$/i;

/** The parts a trader's line splits into before any lookup. Pure; tested. */
export function tokenize(line: string) {
  const out = { carats: null as number | null, rate: null as number | null, words: [] as string[] };
  for (const raw of line.trim().split(/\s+/).filter(Boolean)) {
    const t = raw.replace(/[,;]$/, '');
    let m: RegExpMatchArray | null;
    if ((m = t.match(RATE))) out.rate = Number(m[1].replace(/,/g, ''));
    else if ((m = t.match(CARATS)) && out.carats === null) out.carats = Number(m[1]);
    else out.words.push(t);
  }
  return out;
}

/**
 * "RD-100 EF VVS 2.35 @4200" -> a spec, carats and a rate. A word that is a
 * saved Size ID becomes the size; every other word is tried against the grade
 * lists in order (type, colour, clarity, certified, lab), each field once.
 */
export async function parseShorthand(line: string): Promise<Shorthand> {
  const t = tokenize(line);
  const spec: Shorthand['spec'] = {};
  const unknown: string[] = [];
  const sizes = t.words.length
    ? await sql`SELECT id FROM diamond_sizes WHERE id = ANY(${t.words.map((w) => w.toUpperCase())}::text[])`
    : [];
  const sizeIds = new Set((sizes as { id: string }[]).map((r) => r.id));

  for (const w of t.words) {
    if (!spec.sizeId && sizeIds.has(w.toUpperCase())) { spec.sizeId = w.toUpperCase(); continue; }
    const field = (Object.keys(GRADES) as GradeField[]).find((f) => !spec[f] && gradeValue(f, w));
    if (field) spec[field] = gradeValue(field, w)!;
    else unknown.push(w);
  }
  return { spec, carats: t.carats, rate: t.rate, unknown };
}
