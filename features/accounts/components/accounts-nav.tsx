'use client';

import { usePathname } from 'next/navigation';
import { SectionTabs } from '@/components/layout/section-tabs';

export const ACCOUNTS_TABS = [
  { href: '/accounts', label: 'Balances & aging' },
  { href: '/accounts/bills', label: 'Bills' },
] as const;

export function AccountsNav() {
  const pathname = usePathname();
  return (
    <SectionTabs
      items={ACCOUNTS_TABS.map((t) => ({
        href: t.href,
        label: t.label,
        active: t.href === '/accounts'
          ? pathname === '/accounts'
          : pathname === t.href || pathname.startsWith(t.href + '/'),
      }))}
    />
  );
}
