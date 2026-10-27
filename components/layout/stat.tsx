import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A figure inline, for a summary row above a table. */
export function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn('font-semibold tabular-nums', tone)}>{value}</div>
    </div>
  );
}

/**
 * Several headline figures read as one statement, not a row of identical
 * boxes: one surface, divided by hairlines, stacking on phones.
 */
export function StatStrip({ items }: {
  items: { label: string; value: string; sub?: ReactNode; tone?: string; title?: string }[];
}) {
  return (
    <Card size="sm" className="py-0">
      <dl className="grid divide-y sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0">
        {items.map((s) => (
          <div key={s.label} className="px-4 py-3.5">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd title={s.title} className={cn('mt-1.5 text-xl font-semibold leading-tight tabular-nums', s.tone)}>
              {s.value}
            </dd>
            {s.sub && <dd className="mt-1.5 text-xs text-muted-foreground">{s.sub}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  );
}
