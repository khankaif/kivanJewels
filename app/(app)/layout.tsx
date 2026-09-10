import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { MainNav } from '@/components/layout/main-nav';
import { CommandPalette } from '@/components/layout/command-palette';
import { Button } from '@/components/ui/button';
import { Gem, Search } from 'lucide-react';
import { signOut } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--app-glow),_transparent_45%)]">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-7">
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Gem className="size-4" strokeWidth={2.25} />
              </span>
              <span className="hidden text-sm font-semibold tracking-tight sm:inline">Kaivan Jewels</span>
            </div>
            <MainNav />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground lg:flex">
              <Search className="size-3" /> Search <kbd className="font-sans text-[10px]">⌘K</kbd>
            </span>
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:inline">{session.user.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <span className="hidden sm:inline">Sign out</span>
                <span className="sm:hidden">Out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <CommandPalette />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
