'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/accounts', label: 'Balances & aging' },
  { href: '/accounts/bills', label: 'Bills' },
  { href: '/accounts/register', label: 'Money register' },
];

export function AccountsNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((t) => {
        const active = t.href === '/accounts'
          ? pathname === '/accounts'
          : pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href} href={t.href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
