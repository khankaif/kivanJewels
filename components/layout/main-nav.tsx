'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/stock', label: 'Stock' },
  { href: '/movements', label: 'Movements' },
  { href: '/memos', label: 'Memos' },
  { href: '/bills', label: 'Bills' },
  { href: '/ledger', label: 'Register' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/parties', label: 'Parties' },
  { href: '/masters/diamonds', label: 'Diamond master' },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            pathname === item.href
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
