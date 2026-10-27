import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { AppSidebar } from '@/components/layout/main-nav';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/sign-in');

  return (
    <SidebarProvider>
      <AppSidebar email={session.user.email} />
      <SidebarInset className="bg-background">
        <main className="w-full px-4 pb-10 lg:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
