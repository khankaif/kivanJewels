'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { day } from '@/lib/format';
import { cn } from '@/lib/utils';

/** ISO date <-> a local calendar day. A date is a day, never shifted by timezone. */
const toDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * shadcn's date picker (Popover + Calendar) that still posts an ISO date
 * under `name`, so server actions read it exactly as they read the native one.
 */
export function DateField({
  id, name, value, defaultValue = '', onChange, required, disabled, placeholder = 'Pick a date', className,
}: {
  id?: string; name?: string; value?: string; defaultValue?: string; onChange?: (iso: string) => void;
  required?: boolean; disabled?: boolean; placeholder?: string; className?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const iso = value ?? own;

  const set = (next: string) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id} type="button" variant="outline" disabled={disabled}
            className={cn('w-full justify-start font-normal', !iso && 'text-muted-foreground', className)}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {iso ? day(iso) : placeholder}
      </PopoverTrigger>
      {/* Carries the value into the form. Not type="hidden": a hidden input
          cannot be `required`, and an empty required date must block the save. */}
      {name && (
        <input
          name={name} value={iso} required={required} onChange={() => {}}
          tabIndex={-1} aria-hidden className="sr-only"
        />
      )}
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single" selected={toDate(iso)} defaultMonth={toDate(iso)}
          onSelect={(d) => { set(d ? toIso(d) : ''); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}
