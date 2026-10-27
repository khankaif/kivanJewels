import Link from 'next/link';
import { Button } from '@/components/ui/button';

export type TabItem = { href: string; label: string; active: boolean };

/** Views of a section, as the header's second row. Links, not shadcn Tabs: each is its own route. */
export function SectionTabs({ items }: { items: TabItem[] }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((t) => (
        <Button
          key={t.href} variant="ghost" size="sm" nativeButton={false}
          aria-current={t.active ? 'page' : undefined}
          className="h-9 rounded-none border-b-2 border-b-transparent px-2 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground aria-[current=page]:border-b-foreground aria-[current=page]:text-foreground"
          render={<Link href={t.href} />}
        >
          {t.label}
        </Button>
      ))}
    </nav>
  );
}
