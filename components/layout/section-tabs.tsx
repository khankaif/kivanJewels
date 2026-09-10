import Link from 'next/link';
import { cn } from '@/lib/utils';

export type TabItem = { href: string; label: string; active: boolean };

export function SectionTabs({ items }: { items: TabItem[] }) {
  return (
    <div className="flex gap-1 border-b">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            t.active
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
