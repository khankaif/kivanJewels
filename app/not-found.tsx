import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-24">
      <Empty>
        <EmptyHeader>
          <EmptyTitle className="text-lg">Nothing here</EmptyTitle>
          <EmptyDescription>The page may have moved, or the link was mistyped.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>Go home</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
