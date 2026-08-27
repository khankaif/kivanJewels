const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  sept: 9, // source workbook uses "Sept"/"sept" (201 rows across date columns)
  jn: 6,   // source typo for "Jun" (7 rows)
};

function iso(y: number, m: number, d: number): string | null {
  // Reject rollovers: new Date(2024, 1, 31) silently becomes Mar 2.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const fullYear = (yy: number) => (yy < 100 ? 2000 + yy : yy);

/**
 * Parses the five date formats present in the source workbook.
 * Returns ISO YYYY-MM-DD, or null for blanks and sentinels like "Pending" / "-".
 */
export function parseLooseDate(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s || s === '-' || s.toLowerCase() === 'pending') return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    return mon ? iso(fullYear(+m[3]), mon, +m[1]) : null;
  }

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]); // day-first: Indian convention

  return null;
}
