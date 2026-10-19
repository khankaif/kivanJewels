import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

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
  fields, exportHref, action, hidden,
}: {
  fields: FieldDef[]; exportHref?: string; action?: string;
  /** Params the form must carry through, like the tab it lives on. */
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f) => (
        <div key={f.name} className="space-y-1">
          {f.type !== 'checkbox' && (
            <Label htmlFor={f.name} className="block text-xs text-muted-foreground">{f.label}</Label>
          )}
          {f.type === 'text' && (
            <Input id={f.name} name={f.name} defaultValue={f.value ?? ''}
                   placeholder={f.placeholder} className="w-48" />
          )}
          {f.type === 'date' && (
            <Input id={f.name} name={f.name} type="date" defaultValue={f.value ?? ''} className="w-40" />
          )}
          {f.type === 'select' && (
            <NativeSelect id={f.name} name={f.name} defaultValue={f.value ?? ''}
                    className="w-44">
              {f.options.map((o) => <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>)}
            </NativeSelect>
          )}
          {f.type === 'checkbox' && (
            <Label className="h-8 font-normal">
              <Checkbox name={f.name} value="1" defaultChecked={f.checked} />
              {f.label}
            </Label>
          )}
        </div>
      ))}
      <Button type="submit" variant="secondary">Apply</Button>
      {exportHref && (
        <Button type="button" variant="outline" nativeButton={false} render={<a href={exportHref} />}>
          Export CSV
        </Button>
      )}
    </form>
  );
}
