'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type Picklists = { shapes: string[]; colours: string[]; clarities: string[] };

/**
 * The five columns that name a parcel, plus the stone type. Shared by every
 * sheet that brings goods in, so a picklist added in the master shows up in
 * all of them at once.
 *
 * `id` prefixes the field ids: two of these can be open on one page.
 */
export function SpecFields({
  id, shapes, colours, clarities, autoFocus = false,
}: Picklists & { id: string; autoFocus?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor={`${id}-type`}>
          <Input id={`${id}-type`} name="stoneType" defaultValue="Lab Grown" autoFocus={autoFocus} />
        </Field>
        <Field label="Shape" htmlFor={`${id}-shape`}>
          <Input id={`${id}-shape`} name="shape" list={`${id}-shape-list`} placeholder="Round" />
          <datalist id={`${id}-shape-list`}>
            {shapes.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sieve" htmlFor={`${id}-sieve`}>
          <Input id={`${id}-sieve`} name="sieveSize" placeholder="8.5-9" />
        </Field>
        <Field label="MM" htmlFor={`${id}-mm`}>
          <Input id={`${id}-mm`} name="mmSize" placeholder="2.20" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Colour" htmlFor={`${id}-colour`}>
          <Input id={`${id}-colour`} name="colour" list={`${id}-colour-list`} placeholder="EF" />
          <datalist id={`${id}-colour-list`}>
            {colours.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Clarity" htmlFor={`${id}-clarity`}>
          <Input id={`${id}-clarity`} name="clarity" list={`${id}-clarity-list`} placeholder="VVS-VS" />
          <datalist id={`${id}-clarity-list`}>
            {clarities.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
      </div>
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
