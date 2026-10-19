import Link from 'next/link';
import { Button } from '@/components/ui/button';

export type TabItem = { href: string; label: string; active: boolean };

/** Sub-pages of a section. Links, not shadcn Tabs: each one is its own route. */
export function SectionTabs({ items }: { items: TabItem[] }) {
  return (
    <nav className="flex gap-1 border-b">
      {items.map((t) => (
        <Button
          key={t.href} variant="ghost" nativeButton={false}
          aria-current={t.active ? 'page' : undefined}
          className="-mb-px rounded-none border-b-2 border-b-transparent text-muted-foreground hover:bg-transparent aria-[current=page]:border-b-foreground aria-[current=page]:text-foreground"
          render={<Link href={t.href} />}
        >
          {t.label}
        </Button>
      ))}
    </nav>
  );
}
