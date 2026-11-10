import { canonicalPartyName } from '@/lib/normalize';

/** The party fields a form or a CSV row can set. CSV headers use these names. */
export const PARTY_COLUMNS = [
  'name', 'business_name', 'kind', 'default_terms_days', 'phone', 'email',
  'gstin', 'pan', 'contact_person', 'address', 'notes',
] as const;
export type PartyColumn = (typeof PARTY_COLUMNS)[number];
export type PartyFields = { name: string; kind: string; default_terms_days: number } &
  Record<Exclude<PartyColumn, 'name' | 'kind' | 'default_terms_days'>, string | null>;

const KINDS = ['supplier', 'client', 'both'];

/**
 * One party, validated: the single rule set the Add party form and the CSV
 * import share, so an import can never store a party the form would refuse.
 * Blank role = both, blank terms = 7 days (the table's defaults).
 */
export function readParty(get: (c: PartyColumn) => unknown): { error: string } | { party: PartyFields } {
  const text = (c: PartyColumn) => String(get(c) ?? '').trim() || null;
  const name = canonicalPartyName(get('name'));
  const kind = (text('kind') ?? 'both').toLowerCase();
  const termsText = text('default_terms_days');
  const terms = termsText === null ? 7 : Number(termsText);

  if (!name) return { error: 'Party name is required.' };
  if (!KINDS.includes(kind)) return { error: `Role must be supplier, client or both (got "${text('kind')}").` };
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
    return { error: 'Credit terms must be a whole number of days between 0 and 365.' };
  }
  return {
    party: {
      name, kind, default_terms_days: terms,
      business_name: text('business_name'), phone: text('phone'), email: text('email'),
      gstin: text('gstin')?.toUpperCase() ?? null, pan: text('pan')?.toUpperCase() ?? null,
      contact_person: text('contact_person'), address: text('address'), notes: text('notes'),
    },
  };
}
