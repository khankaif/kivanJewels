/** Collapse key: case, internal spacing and punctuation are not identity. */
export const partyKey = (s: string) => s.toLowerCase().replace(/[.\s]+/g, '');

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
 *
 * Note: this alone cannot collapse "A B Creation" vs "A.B.Creation" (different
 * word counts). Callers importing many names must group by partyKey and pick one
 * display spelling per key -- see resolveParties.
 */
export function canonicalPartyName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s || s === '-' || s.toLowerCase() === 'none') return null;
  return titleCase(s);
}

/**
 * Groups raw spellings by collapse key and picks one display name per group
 * (the longest raw spelling, title-cased). Returns key -> display name.
 */
export function resolveParties(raws: Iterable<unknown>): Map<string, string> {
  const longest = new Map<string, string>();
  for (const raw of raws) {
    const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (!s || s === '-' || s.toLowerCase() === 'none') continue;
    const k = partyKey(s);
    if (!longest.has(k) || s.length > longest.get(k)!.length) longest.set(k, s);
  }
  return new Map([...longest].map(([k, raw]) => [k, titleCase(raw)]));
}
