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
    <nav className="-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]">
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
              'whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
