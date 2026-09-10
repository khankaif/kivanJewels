import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NAV } from '../components/layout/main-nav';
import { ACCOUNTS_TABS } from '../features/accounts/components/accounts-nav';
import { MASTERS_TABS } from '../features/masters/components/masters-nav';

/** '/stock' -> 'app/(app)/stock/page.tsx'; '/' -> 'app/(app)/page.tsx'. */
function routeFile(href: string): string {
  const path = href.split('?')[0].replace(/^\/|\/$/g, '');
  return path ? `app/(app)/${path}/page.tsx` : 'app/(app)/page.tsx';
}

test('every nav link points at a route that exists', () => {
  for (const entry of NAV) {
    assert.ok(existsSync(routeFile(entry.href)), `${entry.href} -> ${routeFile(entry.href)} missing`);
  }
});

test('navigation is five flat sections', () => {
  assert.deepEqual(
    NAV.map((n) => n.label),
    ['Today', 'Stock', 'Sales', 'Accounts', 'Masters'],
  );
});

test('section tabs point at routes that exist', () => {
  for (const t of [...ACCOUNTS_TABS, ...MASTERS_TABS]) {
    assert.ok(existsSync(routeFile(t.href)), `${t.href} -> ${routeFile(t.href)} missing`);
  }
});

test('accounts exposes the money register as its own tab', () => {
  assert.ok(ACCOUNTS_TABS.some((t) => t.href.includes('grain=entries')));
});
