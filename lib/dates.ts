/** Today as an ISO date, the default on every dated form. */
export const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The ISO date `days` after an ISO date. Terms are counted in whole calendar
 * days, so this is UTC arithmetic -- no local timezone can shift it a day.
 */
export function addDays(from: string, days: number): string {
  const t = Date.parse(`${from}T00:00:00Z`);
  if (Number.isNaN(t) || !Number.isFinite(days)) return from;
  return new Date(t + Math.trunc(days) * 86_400_000).toISOString().slice(0, 10);
}
