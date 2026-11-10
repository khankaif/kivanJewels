// Size chart rules, pure (ported from Medusa modules/diamond/pricing.ts). Tested.

// Carats per stone. From 0.001 so melee bands fit (most parcels here are melee).
export const MIN_CT = 0.001;
export const MAX_CT = 3;

export type Band = { min_ct: number; max_ct: number; nominal_ct: number };
export type Anchor = { length_mm: number; width_mm: number };

// Excel ROUND(x, 2): trim to 15 significant digits first (as Excel does), then half away from zero.
const round2 = (x: number) => {
  const v = Number(x.toPrecision(15));
  return (Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-9)) / 100;
};

/** Estimated face-up mm: 1 ct anchor x nominal^(1/3), to 0.01 mm. A planning estimate only. */
export const estimateMm = (nominal_ct: number, a: Anchor) => ({
  est_length_mm: round2(a.length_mm * Math.cbrt(nominal_ct)),
  est_width_mm: round2(a.width_mm * Math.cbrt(nominal_ct)),
});

/**
 * RD + 1.00 ct -> RD-100. Null when the nominal isn't whole hundredths (melee
 * such as 0.003 ct would round onto another size's ID): those are typed.
 */
export function sizeId(prefix: string, nominal_ct: number): string | null {
  const h = Math.round(nominal_ct * 1e4) / 100;
  return Number.isInteger(h) && h > 0 ? `${prefix}-${String(h).padStart(3, '0')}` : null;
}

/**
 * The starter grid: 40 sizes per shape, 0.05 to 2.00 ct in 0.05 steps, each
 * band reaching halfway to its neighbours ([0.050, 0.075), [0.075, 0.125) …
 * [1.975, 2.000]). Worked in thousandths so band edges are exact.
 */
export const standardBands = (): Band[] =>
  Array.from({ length: 40 }, (_, i) => {
    const k = i + 1;
    return {
      min_ct: k === 1 ? 0.05 : (k * 50 - 25) / 1000,
      max_ct: k === 40 ? 2 : (k * 50 + 25) / 1000,
      nominal_ct: (k * 50) / 1000,
    };
  });

/** Why a band can't be saved, or null. The database checks the same, as a backstop. */
export function bandProblem(b: Partial<Band>): string | null {
  const { min_ct, max_ct, nominal_ct } = b;
  if (min_ct == null || max_ct == null || nominal_ct == null) return 'Enter min, max and nominal carats.';
  if (min_ct < MIN_CT || max_ct > MAX_CT) return `Sizes run from ${MIN_CT} to ${MAX_CT} ct.`;
  if (min_ct >= max_ct) return 'Min ct must be below max ct.';
  if (nominal_ct < min_ct || nominal_ct > max_ct) return 'Nominal ct must be within the band.';
  return null;
}

/** A closed band (nominal = max) also holds its upper bound. */
export const bandLabel = (b: Band) =>
  b.nominal_ct === b.max_ct ? `${b.min_ct} – ${b.max_ct} ct` : `${b.min_ct} – <${b.max_ct} ct`;
