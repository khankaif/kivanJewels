'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gem, Images, LayoutGrid, LogOut, Package, ReceiptIndianRupee, Settings2, ShoppingBag,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/actions';
import { CommandPalette } from '@/components/layout/command-palette';

/**
 * Six sections, flat. Sub-views are tabs inside a section, not nav entries:
 * a menu that lists what a page already lists is a second place to be wrong.
 */
export const NAV = [
  { href: '/', label: 'Today', icon: LayoutGrid },
  { href: '/stock', label: 'Stock', icon: Package },
  { href: '/sales', label: 'Sales', icon: ShoppingBag },
  { href: '/accounts', label: 'Accounts', icon: ReceiptIndianRupee },
  { href: '/catalog', label: 'Catalog', icon: Images },
  { href: '/parties', label: 'Masters', icon: Settings2 },
] as const;

/** Masters spans three route trees; everything else owns its own prefix. */
const OWNS: Record<string, string[]> = {
  '/parties': ['/parties', '/masters', '/settings'],
};

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isActive = (href: string) => href === '/'
    ? pathname === '/'
    : (OWNS[href] ?? [href]).some((p) => pathname === p || pathname.startsWith(p + '/'));

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2">
        <Link href="/" className="flex items-center gap-2 px-1">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <Gem className="size-3.5" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold text-foreground">Kaivan Jewels</span>
        </Link>
        <CommandPalette />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={isActive(href)}
                    className="h-7 rounded-sm px-2 text-sm text-muted-foreground data-active:text-foreground [&_svg]:size-4"
                    render={<Link href={href} onClick={() => setOpenMobile(false)} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <form action={signOut} className="flex items-center gap-2 rounded-md px-1 py-1">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground">
            {email.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{email}</span>
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out" className="text-muted-foreground">
            <LogOut />
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
