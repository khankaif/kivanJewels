import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * The one header every page shares: a compact sticky bar with where you are,
 * what this is, and what you can do -- then, when a section has views, the
 * view tabs as its second row. Nothing above the work but this.
 */
export function PageHeader({ title, parent, badges, detail, actions, tabs }: {
  title: ReactNode;
  /** A breadcrumb back to the list this record belongs to. */
  parent?: { href: string; label: string };
  badges?: ReactNode;
  /** One short line: a count, a date, who it belongs to. */
  detail?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 backdrop-blur-xl lg:-mx-6 lg:px-6">
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 py-1.5">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          {parent && (
            <>
              <Link href={parent.href} className="text-sm text-tertiary transition-colors hover:text-foreground">
                {parent.label}
              </Link>
              <ChevronRight className="size-3.5 text-tertiary" />
            </>
          )}
          <h1 className="text-sm font-medium text-foreground">{title}</h1>
          {badges}
          {detail && <span className="text-sm text-tertiary">{detail}</span>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}
