import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { MainNav } from '@/components/layout/main-nav';
import { CommandPalette } from '@/components/layout/command-palette';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/sign-in');

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold tracking-tight">Aurum ERP</span>
            <MainNav />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">⌘K to search</span>
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
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
