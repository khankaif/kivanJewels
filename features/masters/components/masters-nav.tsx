'use client';

import { usePathname } from 'next/navigation';
import { SectionTabs } from '@/components/layout/section-tabs';

export const MASTERS_TABS = [
  { href: '/parties', label: 'Parties' },
  { href: '/masters/grades', label: 'Grades' },
  { href: '/masters/diamonds', label: 'Sizes' },
  { href: '/masters/prices', label: 'Prices' },
  { href: '/settings/staff', label: 'Staff & access' },
] as const;

export function MastersNav() {
  const pathname = usePathname();
  return (
    <SectionTabs
      items={MASTERS_TABS.map((t) => ({ href: t.href, label: t.label, active: pathname === t.href }))}
    />
  );
}
