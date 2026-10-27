import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

/** Documents print on their own page: no sidebar, no header, just the paper. */
export default async function PrintLayout({ children }: LayoutProps<'/'>) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/sign-in');
  return (
    <div className="min-h-screen bg-muted print:bg-white">
      <style>{'@page { size: A4; margin: 14mm; }'}</style>
      {children}
    </div>
  );
}
