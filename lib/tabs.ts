/**
 * Which tab a `?tab=` param selects. Unknown values fall back to the first tab
 * rather than rendering nothing: a stale bookmark should show a page.
 */
export function resolveTab<T extends string>(param: string | undefined, tabs: readonly T[]): T {
  return tabs.includes(param as T) ? (param as T) : tabs[0];
}
