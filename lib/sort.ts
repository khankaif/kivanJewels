/**
 * Sort lives in the URL as `?sort=balance` (ascending) or `?sort=-balance`
 * (descending), so a sorted view is a link you can bookmark or send.
 * Only whitelisted columns are honoured -- the value reaches SQL.
 */
export type Sort<C extends string> = { col: C; dir: 'asc' | 'desc' };

export function parseSort<C extends string>(raw: unknown, allowed: readonly C[], fallback: Sort<C>): Sort<C> {
  const s = typeof raw === 'string' ? raw : '';
  const desc = s.startsWith('-');
  const col = (desc ? s.slice(1) : s) as C;
  return allowed.includes(col) ? { col, dir: desc ? 'desc' : 'asc' } : fallback;
}

/** The value for a header link: same column flips direction, a new one starts at `first`. */
export function nextSort<C extends string>(current: Sort<C>, col: C, first: 'asc' | 'desc'): string {
  const dir = current.col === col ? (current.dir === 'asc' ? 'desc' : 'asc') : first;
  return dir === 'desc' ? `-${col}` : col;
}
