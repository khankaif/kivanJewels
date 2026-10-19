export const inr = (v: unknown) =>
  '₹' + Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
