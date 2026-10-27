'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** A two-or-three way switch inside a form. Not a tab strip -- it changes what
 *  the form submits, so it is buttons and state, not links. One option is
 *  always on: pressing the current one again does not clear it. */
export function Segmented<T extends string>({
  value, set, options,
}: {
  value: T; set: (v: T) => void; options: [T, string][];
}) {
  return (
    <ToggleGroup
      value={[value]} onValueChange={(v) => v[0] && set(v[0] as T)}
      spacing={1} className="w-full rounded-lg bg-muted p-1"
    >
      {options.map(([v, label]) => (
        <ToggleGroupItem
          key={v} value={v}
          className="flex-1 text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
