/** Collapse key: case, internal spacing and punctuation are not identity. */
const partyKey = (s: string) => s.toLowerCase().replace(/[.\s]+/g, '');

const ACRONYMS = new Set(['llp', 'kia', 'hr', 'ab', 'trp', 'sm', 'abcreation']);

function titleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(partyKey(w)) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Canonical display name for a raw party string.
 * Returns null for blanks and the "-" / "None" placeholders used in the source.
 */
export function canonicalPartyName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s || s === '-' || s.toLowerCase() === 'none') return null;
  return titleCase(s);
}

/** "ÉCLORA — The Circle of Eternal Light" -> "eclora-the-circle-of-eternal-light". */
export const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
