'use client';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList,
} from '@/components/ui/combobox';
import { cn } from '@/lib/utils';

export type Option = { value: string; label: string };

/**
 * One picker for every list in the app, built on shadcn's Select -- or on its
 * Combobox when `searchable`, for lists long enough to type into (parties).
 *
 * Forms keep working unchanged: `name` submits the chosen value, `required`
 * blocks an empty submit, and "" means nothing chosen unless the list itself
 * offers "" as a choice (a filter's "All types").
 */
export function Choice({
  id, name, options, value, defaultValue, onValueChange, placeholder = 'Select…',
  required, disabled, searchable, className, size,
}: {
  id?: string; name?: string; options: Option[];
  value?: string; defaultValue?: string; onValueChange?: (v: string) => void;
  placeholder?: string; required?: boolean; disabled?: boolean;
  searchable?: boolean; className?: string; size?: 'sm' | 'default';
}) {
  const offersEmpty = options.some((o) => o.value === '');
  const norm = (v: string | undefined) => (v === undefined ? undefined : v === '' && !offersEmpty ? null : v);

  if (searchable) {
    const find = (v: string | undefined) =>
      v === undefined ? undefined : options.find((o) => o.value === v) ?? null;
    return (
      <Combobox
        items={options} name={name} required={required} disabled={disabled}
        value={find(value)} defaultValue={find(defaultValue)}
        onValueChange={(o: Option | null) => onValueChange?.(o?.value ?? '')}
        itemToStringLabel={(o: Option) => o.label} itemToStringValue={(o: Option) => o.value}
      >
        <ComboboxInput id={id} placeholder={placeholder} className={cn('w-full', className)} disabled={disabled} />
        <ComboboxContent>
          <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
          <ComboboxList>
            {(o: Option) => <ComboboxItem key={o.value} value={o}>{o.label}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    );
  }

  return (
    <Select
      name={name} items={options} required={required} disabled={disabled}
      value={norm(value)} defaultValue={norm(defaultValue)}
      onValueChange={(v) => onValueChange?.((v as string | null) ?? '')}
    >
      <SelectTrigger id={id} size={size} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
