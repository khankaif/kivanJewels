import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { nextSort, type Sort } from '@/lib/sort';
import { cn } from '@/lib/utils';

/** A column header that sorts by itself: click to sort, click again to flip. */
export function SortHead<C extends string>({ col, label, sort, sp, path, first = 'asc', className }: {
  col: C; label: string; sort: Sort<C>;
  sp: Record<string, string | string[] | undefined>; path: string;
  /** Money columns read best largest-first; names A to Z. */
  first?: 'asc' | 'desc';
  className?: string;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && v && k !== 'page') params.set(k, v);
  params.set('sort', nextSort(sort, col, first));
  const active = sort.col === col;
  const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link
        href={`${path}?${params}`} scroll={false}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        {active && <Arrow className="size-3" />}
      </Link>
    </TableHead>
  );
}
