import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type FieldDef =
  | { type: 'text'; name: string; label: string; placeholder?: string; value?: string }
  | { type: 'date'; name: string; label: string; value?: string }
  | { type: 'select'; name: string; label: string; value?: string; options: { value: string; label: string }[] }
  | { type: 'checkbox'; name: string; label: string; checked?: boolean };

/**
 * Plain GET form. Filters live in the URL, so any view is bookmarkable and
 * shareable, and the CSV export reuses the same query string.
 */
export function FilterBar({
  fields, exportHref, action,
}: { fields: FieldDef[]; exportHref?: string; action?: string }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.name} className="space-y-1">
          {f.type !== 'checkbox' && (
            <label htmlFor={f.name} className="block text-xs text-muted-foreground">{f.label}</label>
          )}
          {f.type === 'text' && (
            <Input id={f.name} name={f.name} defaultValue={f.value ?? ''}
                   placeholder={f.placeholder} className="h-9 w-48" />
          )}
          {f.type === 'date' && (
            <Input id={f.name} name={f.name} type="date" defaultValue={f.value ?? ''} className="h-9 w-40" />
          )}
          {f.type === 'select' && (
            <select id={f.name} name={f.name} defaultValue={f.value ?? ''}
                    className="h-9 w-44 rounded-md border bg-transparent px-3 text-sm">
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {f.type === 'checkbox' && (
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" name={f.name} value="1" defaultChecked={f.checked} className="size-4" />
              {f.label}
            </label>
          )}
        </div>
      ))}
      <Button type="submit" variant="secondary" className="h-9">Apply</Button>
      {exportHref && (
        <Button type="button" variant="outline" className="h-9" render={<a href={exportHref} />}>
          Export CSV
        </Button>
      )}
    </form>
  );
}
