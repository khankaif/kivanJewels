'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

/**
 * Something on this page failed to load. The header and nav stay, so the
 * rest of the app is one click away; nothing the user entered is lost because
 * every save is a server action that either committed or did not.
 */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Empty className="min-h-[50vh]">
      <EmptyHeader>
        <EmptyTitle className="text-lg">This page didn’t load</EmptyTitle>
        <EmptyDescription>
          The connection to the books may have dropped for a moment. Try again; if it keeps
          happening, note the reference below for support.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button onClick={() => retry()}>Try again</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>Go to Today</Button>
        </div>
        {error.digest && <code className="text-xs text-muted-foreground">Ref {error.digest}</code>}
      </EmptyContent>
    </Empty>
  );
}
