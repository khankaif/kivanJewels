'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Leaf = { href: string; label: string };
type Entry = Leaf | { label: string; items: Leaf[] };

/** Workflow order: bring stock in, sell it, chase the money, keep the masters. */
export const NAV: Entry[] = [
  { href: '/', label: 'Dashboard' },
  { label: 'Stock', items: [
    { href: '/stock', label: 'Stock' },
    { href: '/movements', label: 'Movement history' },
  ] },
  { label: 'Sales', items: [
    { href: '/sales', label: 'Requirements' },
    { href: '/memos?dir=out', label: 'Outward memos' },
    { href: '/accounts/bills?direction=sale', label: 'Sale bills' },
  ] },
  { label: 'Purchases', items: [
    { href: '/memos?dir=in', label: 'Inward memos' },
    { href: '/accounts/bills?direction=purchase', label: 'Purchase bills' },
  ] },
  { label: 'Accounts', items: [
    { href: '/accounts', label: 'Balances & aging' },
    { href: '/accounts/bills', label: 'Bills & entries' },
    { href: '/accounts/bills?grain=entries', label: 'Money register' },
  ] },
  { label: 'Masters', items: [
    { href: '/parties', label: 'Parties' },
    { href: '/masters/diamonds', label: 'Diamond master' },
  ] },
];

const base = (href: string) => href.split('?')[0];

export function MainNav() {
  const pathname = usePathname();
  const link = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors';
  const on = 'bg-accent text-accent-foreground';
  const off = 'text-muted-foreground hover:text-foreground';

  return (
    <nav className="flex items-center gap-1">
      {NAV.map((entry) => {
        if ('href' in entry) {
          return (
            <Link
              key={entry.href} href={entry.href}
              className={cn(link, pathname === entry.href ? on : off)}
            >
              {entry.label}
            </Link>
          );
        }
        // Only routes this group owns drive the active state — cross-links
        // (a `?` deep-link into another section) light up their real home, not this one.
        const active = entry.items
          .filter((i) => !i.href.includes('?'))
          .some((i) => pathname === base(i.href) || pathname.startsWith(base(i.href) + '/'));
        return (
          <DropdownMenu key={entry.label}>
            <DropdownMenuTrigger
              className={cn(link, 'flex items-center gap-1', active ? on : off)}
            >
              {entry.label}
              <ChevronDownIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto min-w-44">
              {entry.items.map((i) => (
                <DropdownMenuItem key={i.href} render={<Link href={i.href} />}>
                  {i.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
