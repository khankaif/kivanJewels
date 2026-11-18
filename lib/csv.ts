// Minimal RFC 4180 CSV (same as the Medusa admin's): quoted fields, "" escapes,
// commas and newlines inside quotes. Excel's UTF-8 byte-order mark is dropped,
// or the first header would read "\uFEFFname" and never match "name".
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** One cell. A leading = + - @ is quoted with ' so Excel never runs it as a formula (CSV injection). */
export const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * Rows to CSV text, headers first. Starts with a UTF-8 byte-order mark: without
 * it Excel reads the file as ANSI and garbles anything past ASCII.
 */
export const toCsv = (cols: string[], rows: Record<string, unknown>[]) =>
  '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
