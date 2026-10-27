'use client';

import { useEffect, useRef, useState } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Download, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Choice } from '@/components/forms/choice';
import { DateField } from '@/components/forms/date-field';
import { cn } from '@/lib/utils';

export type FieldDef =
  | { type: 'text'; name: string; label: string; placeholder?: string; value?: string }
  | { type: 'date'; name: string; label: string; value?: string }
  | { type: 'select'; name: string; label: string; value?: string; options: { value: string; label: string }[] }
  | { type: 'checkbox'; name: string; label: string; checked?: boolean };

/** Values that mean "no filter": an empty select, or a select's own catch-all. */
const isDefault = (f: FieldDef, v: string) => !v || (f.type === 'select' && v === f.options[0]?.value);

/**
 * Filters live in the URL, so any view is bookmarkable and the CSV export reuses
 * the same query. They apply as you change them -- there is no Apply step to
 * forget -- and each active one shows as a chip that removes it.
 */
export function FilterBar({
  fields, exportHref, action, hidden,
}: {
  fields: FieldDef[]; exportHref?: string; action?: string;
  /** Params the form must carry through, like the tab it lives on. */
  hidden?: Record<string, string>;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const form = useRef<HTMLFormElement>(null);
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);

  // The URL is the source of truth: when a chip or Clear changes it, bring the
  // fields along -- except the one being typed in, which already leads.
  useEffect(() => {
    for (const f of fields) {
      const el = form.current?.elements.namedItem(f.name);
      if (el === document.activeElement) continue;
      const v = sp.get(f.name) ?? '';
      if (el instanceof HTMLInputElement && f.type === 'text') el.value = v;
    }
  }, [sp, fields]);

  const submit = () => form.current?.requestSubmit();
  const submitSoon = () => {
    clearTimeout(typing.current);
    typing.current = setTimeout(submit, 400);
  };

  const active = fields.flatMap((f) => {
    const v = sp.get(f.name) ?? '';
    if (isDefault(f, v)) return [];
    const shown = f.type === 'select' ? f.options.find((o) => o.value === v)?.label ?? v
      : f.type === 'checkbox' ? f.label : v;
    return [{ name: f.name, text: f.type === 'checkbox' ? shown : `${f.label}: ${shown}` }];
  });
  const without = (names: string[]) => {
    const next = new URLSearchParams(sp);
    for (const n of [...names, 'page']) next.delete(n);
    return `${pathname}?${next}`;
  };

  return (
    <div className="space-y-2">
      <Button
        type="button" variant="outline" size="sm" className="sm:hidden"
        aria-expanded={open} onClick={() => setOpen((o) => !o)}
      >
        <SlidersHorizontal data-icon="inline-start" /> Filters{active.length ? ` · ${active.length}` : ''}
      </Button>

      <Form
        ref={form} action={action ?? pathname}
        className={cn('flex-wrap items-center gap-x-4 gap-y-2 max-sm:flex-col max-sm:items-stretch', open ? 'flex' : 'hidden sm:flex')}
      >
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {fields.map((f) => (
          // Labels sit inline, like "Status [Unpaid]": the toolbar stays one line.
          <div key={f.name} className="flex items-center gap-2">
            {f.type !== 'checkbox' && (
              <Label htmlFor={f.name} className={cn('shrink-0 text-xs font-normal text-muted-foreground', f.type === 'text' && 'sr-only')}>
                {f.label}
              </Label>
            )}
            {f.type === 'text' && (
              <Input
                id={f.name} name={f.name} type="search" defaultValue={f.value ?? ''}
                placeholder={f.placeholder} className="sm:w-60" onChange={submitSoon}
              />
            )}
            {/* Keyed to the URL: a chip or Clear changes the URL, and the picker
                remounts on the new value instead of holding the old one. */}
            {f.type === 'date' && (
              <DateField
                key={sp.get(f.name) ?? ''} id={f.name} name={f.name} defaultValue={f.value ?? ''}
                placeholder="Any date" className="h-8 sm:w-36" onChange={() => setTimeout(submit)}
              />
            )}
            {f.type === 'select' && (
              <Choice
                key={sp.get(f.name) ?? ''} id={f.name} name={f.name} defaultValue={f.value ?? ''}
                options={f.options} searchable={f.options.length > 12}
                placeholder={f.options[0]?.label} className="sm:w-auto sm:min-w-40"
                onValueChange={() => setTimeout(submit)}
              />
            )}
            {f.type === 'checkbox' && (
              <Label key={sp.get(f.name) ?? ''} className="h-8 font-normal">
                <Checkbox name={f.name} value="1" defaultChecked={f.checked} onCheckedChange={() => setTimeout(submit)} />
                {f.label}
              </Label>
            )}
          </div>
        ))}
        {/* Enter in a text field still submits; everything else applies on change. */}
        <Button type="submit" className="sr-only">Apply filters</Button>
        {exportHref && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground sm:ml-auto" nativeButton={false} render={<a href={exportHref} />}>
            <Download data-icon="inline-start" /> Export CSV
          </Button>
        )}
      </Form>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((a) => (
            <Badge key={a.name} variant="secondary" className="h-6 gap-1 pr-1" render={<Link href={without([a.name])} />}>
              {a.text}
              <X aria-label={`Remove ${a.text}`} />
            </Badge>
          ))}
          <Button variant="link" size="xs" nativeButton={false} render={<Link href={without(active.map((a) => a.name))} />}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
