'use client';

import { cn } from '@/lib/utils';

/** A two-or-three way switch inside a form. Not a tab strip -- it changes what
 *  the form submits, so it is buttons and state, not links. */
export function Segmented<T extends string>({
  value, set, options,
}: {
  value: T; set: (v: T) => void; options: [T, string][];
}) {
  return (
    <div
      className="grid gap-1 rounded-lg bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([v, label]) => (
        <button
          key={v} type="button" onClick={() => set(v)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
