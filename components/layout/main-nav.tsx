'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
          <Button
            key={href} variant="ghost" nativeButton={false}
            aria-current={active ? 'page' : undefined}
            className="text-muted-foreground sm:px-3 aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
            render={<Link href={href} />}
          >
            {label}
          </Button>
        );
      })}
    </nav>
  );
}
