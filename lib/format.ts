/** Exact rupees with paise. A negative reads "−₹5,000.00", sign before the symbol. */
export const inr = (v: unknown) => {
  const n = Number(v ?? 0);
  return (n < 0 ? '−₹' : '₹')
    + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const ct = (v: unknown) =>
  Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ct';

export const pct = (v: unknown) => `${Number(v ?? 0).toFixed(1)}%`;

/**
 * How a stone reads on a row: size, grade, and -- when it has one -- the
 * certificate. Every list used to compose this inline and they had drifted
 * apart; certification is identity now, so it has to appear everywhere.
 */
export const specLabel = (s: {
  shape?: string | null; sieveSize?: string | null; mmSize?: string | null;
  colour?: string | null; clarity?: string | null;
  lab?: string | null; certified?: string | null;
}) => {
  const cert = s.lab
    ? `${s.lab} cert`
    : s.certified && s.certified.toLowerCase().startsWith('cert') ? 'certified' : null;
  return [s.sieveSize, s.mmSize && `${s.mmSize}mm`, s.shape, s.colour, s.clarity, cert]
    .filter(Boolean).join(' · ') || '—';
};

/** A shelf price: whole rupees, as a price tag reads, not a ledger amount. */
export const mrp = (v: unknown) =>
  '₹' + Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** A weight as printed on a piece card: no trailing zeros. */
export const weight = (v: unknown, unit: string) =>
  `${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit}`;

/**
 * A headline amount, read the way an Indian ledger is read aloud: crore and
 * lakh. Exact paise belong on a bill, not on a summary card.
 */
export const money = (v: unknown) => {
  const n = Number(v ?? 0);
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`;
};

/**
 * "3 Sep" this year, "3 Sep 2025" otherwise. An ISO date is a calendar day,
 * not a moment, so it is read as UTC and never shifted by the viewer's zone.
 */
export const day = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const thisYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'UTC', ...(thisYear ? {} : { year: 'numeric' }),
  });
};
