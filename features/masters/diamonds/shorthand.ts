import { sql } from '@/db/client';
import { BUCKET_FOR, type SpecField } from '@/lib/spec-rules';

export type Shorthand = {
  spec: Partial<Record<SpecField, string>>;
  carats: number | null;
  rate: number | null;
  /** Words nothing recognised, shown back so a typo is visible, not silently dropped. */
  unknown: string[];
};

const RATE = /^@([\d,]+(?:\.\d+)?)$/;
const CARATS = /^(\d+(?:\.\d+)?)(?:ct|cts)?$/i;
const MM = /^(\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)?)mm$/i;
const SIEVE = /^(\+?\d+(?:\.\d+)?-\d+(?:\.\d+)?|\+\d+(?:\.\d+)?|-\d+(?:\.\d+)?)$/;

/** The parts a trader's line splits into before any master lookup. Pure; tested. */
export function tokenize(line: string) {
  const out = { sieve: null as string | null, mm: null as string | null, carats: null as number | null,
                rate: null as number | null, words: [] as string[] };
  for (const raw of line.trim().split(/\s+/).filter(Boolean)) {
    const t = raw.replace(/[,;]$/, '');
    let m: RegExpMatchArray | null;
    if ((m = t.match(RATE))) out.rate = Number(m[1].replace(/,/g, ''));
    else if ((m = t.match(MM))) out.mm = m[1].toLowerCase();
    else if (t.match(SIEVE) && !out.sieve) out.sieve = t.replace(/^\+/, '+');
    else if ((m = t.match(CARATS)) && out.carats === null) out.carats = Number(m[1]);
    else out.words.push(t);
  }
  return out;
}

/**
 * "9-9.5 RD DEF VVS 2.35 @4200" -> a spec, carats and a rate. Each remaining
 * word is resolved through the master and its aliases -- the same lookup a
 * save uses -- so the form is filled only with values a save will accept.
 */
export async function parseShorthand(line: string): Promise<Shorthand> {
  const t = tokenize(line);
  const spec: Shorthand['spec'] = {};
  if (t.sieve) spec.sieveSize = t.sieve;
  if (t.mm) spec.mmSize = t.mm;

  const fields = Object.entries(BUCKET_FOR) as [SpecField, string][];
  const unknown: string[] = [];
  if (t.words.length) {
    const rows = await sql`
      SELECT w.word, f.field, master_value(f.bucket, w.word) AS value
      FROM unnest(${t.words}::text[]) WITH ORDINALITY AS w(word, n)
      CROSS JOIN unnest(${fields.map(([f]) => f)}::text[], ${fields.map(([, b]) => b)}::text[]) AS f(field, bucket)
      ORDER BY w.n`;
    const hits = new Map<string, { field: SpecField; value: string }>();
    for (const r of rows as { word: string; field: SpecField; value: string | null }[]) {
      // First bucket that knows the word wins, in BUCKET_FOR order (type, shape,
      // colour, clarity, lab, certified), and each field is filled once.
      if (r.value && !hits.has(r.word) && !spec[r.field]) {
        hits.set(r.word, { field: r.field, value: r.value });
        spec[r.field] = r.value;
      }
    }
    for (const w of t.words) if (!hits.has(w)) unknown.push(w);
  }
  return { spec, carats: t.carats, rate: t.rate, unknown };
}
