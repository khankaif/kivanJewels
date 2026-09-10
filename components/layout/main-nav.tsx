'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Five sections, flat. Sub-views are tabs inside a section, not nav entries:
 * a menu that lists what a page already lists is a second place to be wrong.
 */
export const NAV = [
  { href: '/', label: 'Today' },
  { href: '/stock', label: 'Stock' },
  { href: '/sales', label: 'Sales' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/parties', label: 'Masters' },
] as const;

/** Masters spans two route trees; everything else owns its own prefix. */
const OWNS: Record<string, string[]> = {
  '/parties': ['/parties', '/masters'],
};

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV.map(({ href, label }) => {
        const prefixes = OWNS[href] ?? [href];
        const active = href === '/'
          ? pathname === '/'
          : prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
