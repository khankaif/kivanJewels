'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { SectionTabs } from '@/components/layout/section-tabs';

export const ACCOUNTS_TABS = [
  { href: '/accounts', label: 'Balances & aging' },
  { href: '/accounts/bills', label: 'Bills' },
  { href: '/accounts/bills?grain=entries', label: 'Every entry' },
] as const;

export function AccountsNav() {
  const pathname = usePathname();
  const entries = useSearchParams().get('grain') === 'entries';
  // Bills and the money register are the same route at two grains, so the
  // active tab is decided by the grain, not by the path alone.
  const onBills = pathname === '/accounts/bills' || pathname.startsWith('/accounts/bills/');

  return (
    <SectionTabs
      items={ACCOUNTS_TABS.map((t) => ({
        href: t.href,
        label: t.label,
        active: t.href === '/accounts'
          ? pathname === '/accounts'
          : onBills && t.href.includes('grain=entries') === entries,
      }))}
    />
  );
}
