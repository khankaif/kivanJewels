import { EPS_CT } from '@/lib/spec-rules';

export type Available = { lotId: string; balance: number };
export type Pick = { lotId: string; carats: number };

/**
 * Splits a wanted quantity across the lots that can fill it, in the order
 * given -- owned stock before goods held on a supplier memo, since memo goods
 * still belong to the supplier.
 *
 * Returns what it could take and what it could not; the caller decides whether
 * a shortfall is an error (delivering now) or just an open line.
 */
export function allocate(lots: Available[], want: number): { picks: Pick[]; short: number } {
  const picks: Pick[] = [];
  let left = want;
  for (const lot of lots) {
    if (left <= EPS_CT) break;
    const take = Math.min(left, Number(lot.balance));
    if (take <= EPS_CT) continue;
    // Carats are numeric(10,3); rounding here keeps the sum from overdrawing
    // a lot by a fraction the database would still reject.
    const carats = Math.floor(take * 1000) / 1000;
    if (carats <= 0) continue;
    picks.push({ lotId: lot.lotId, carats });
    left -= carats;
  }
  return { picks, short: left > EPS_CT ? left : 0 };
}
