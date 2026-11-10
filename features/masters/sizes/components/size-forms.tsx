'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { useFormAction } from '@/lib/use-form-action';
import { Choice } from '@/components/forms/choice';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  deleteShapeAction, deleteSizeAction, generateSizesAction, saveShapeAction, saveSizeAction, type SizeState,
} from '../actions';
import type { DiamondSize, Shape } from '../queries';

/** The sheet + form + inline error every editor here shares. */
function FormSheet({ trigger, label, title, description, action, submit, children, footer }: {
  trigger: ReactElement; label: string; title: string; description: string;
  action: (p: SizeState, fd: FormData) => Promise<SizeState>;
  submit: string; children: ReactNode; footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useFormAction(action, () => setOpen(false));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger}>{label}</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {children}
          {state && 'error' in state && <FieldError>{state.error}</FieldError>}
          <SheetFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : submit}</Button>
          </SheetFooter>
        </form>
        {/* Outside the form: a confirm's own form must not submit this one. */}
        {footer && <div className="px-4 text-sm text-muted-foreground">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

function NumberField({ name, label, unit, defaultValue, placeholder }: {
  name: string; label: string; unit: string; defaultValue?: number | null; placeholder?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label} ({unit})</FieldLabel>
      <Input id={name} name={name} type="number" step="any" min="0"
             defaultValue={defaultValue ?? ''} placeholder={placeholder} />
    </Field>
  );
}

/** Add a shape (no `shape`) or edit one. */
export function ShapeSheet({ shape }: { shape?: Shape }) {
  return (
    <FormSheet
      trigger={shape ? <Button variant="ghost" size="sm" /> : <Button variant="outline" size="sm" />}
      label={shape ? 'Edit' : 'Add shape'} title={shape?.shape ?? 'Add shape'} submit="Save"
      description="Face-up size of a 1.00 ct stone of this shape. Every size's estimated mm = this × carat^(1/3); L/W is its ratio. Leave blank if you don't have it: sizes then need their mm typed."
      action={saveShapeAction}
      footer={shape && (shape.sizes ? `Can't remove: ${shape.sizes} sizes use it.` : (
        <ConfirmAction
          action={deleteShapeAction} fields={{ shape: shape.shape }}
          trigger={<Button variant="ghost" className="text-destructive">Remove shape</Button>}
          title={`Remove ${shape.shape}?`} description="It has no sizes, so nothing else changes." confirm="Remove"
        />
      ))}
    >
      {shape
        ? <input type="hidden" name="original" value={shape.shape} />
        : (
          <Field>
            <FieldLabel htmlFor="shape">Name</FieldLabel>
            <Input id="shape" name="shape" required placeholder="Half Moon" />
          </Field>
        )}
      <Field>
        <FieldLabel htmlFor="prefix">Size ID prefix</FieldLabel>
        <Input id="prefix" name="prefix" defaultValue={shape?.prefix ?? ''} maxLength={3} required
               readOnly={!!shape?.sizes} className="uppercase" />
        <FieldDescription>
          {shape?.sizes ? `Fixed: ${shape.sizes} sizes use it.` : '2–3 letters, e.g. HM for HM-010.'}
        </FieldDescription>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="lengthMm" label="1 ct length" unit="mm" defaultValue={shape?.lengthMm} />
        <NumberField name="widthMm" label="1 ct width" unit="mm" defaultValue={shape?.widthMm} />
      </div>
      {!!shape?.sizes && (
        <Label className="items-start font-normal">
          <Checkbox name="reestimate" value="on" />
          Also re-estimate the {shape.sizes} existing sizes (replaces their mm, including any
          supplier-measured values).
        </Label>
      )}
    </FormSheet>
  );
}

/** Create (no `size`) or edit one size. */
export function SizeSheet({ size, shapes }: { size?: DiamondSize; shapes: Shape[] }) {
  return (
    <FormSheet
      trigger={size ? <Button variant="ghost" size="sm" /> : <Button />}
      label={size ? 'Edit' : 'New size'}
      title={size ? `Edit ${size.id}` : 'New size'} submit={size ? 'Save' : 'Create'}
      description="A carat-per-stone band for one shape. A stone fits when min ≤ ct < max (a band whose nominal is its max includes the max). Melee bands go down to 0.001 ct."
      action={saveSizeAction}
      footer={size && (size.used ? `Can't delete: ${size.used} lots or sale lines use it.` : (
        <ConfirmAction
          action={deleteSizeAction} fields={{ id: size.id }}
          trigger={<Button variant="ghost" className="text-destructive">Delete size</Button>}
          title={`Delete ${size.id}?`} description="This cannot be undone." confirm="Delete"
        />
      ))}
    >
      {size && <input type="hidden" name="originalId" value={size.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="shape">Shape</FieldLabel>
          <Choice id="shape" name="shape" required disabled={!!size} defaultValue={size?.shape}
                  options={shapes.map((s) => ({ value: s.shape, label: s.shape }))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="id">Size ID</FieldLabel>
          <Input id="id" name="id" defaultValue={size?.id} disabled={!!size} placeholder="Blank = RD-100 style"
                 className="uppercase" />
        </Field>
        <NumberField name="minCt" label="Min, inclusive" unit="ct" defaultValue={size?.min_ct} />
        <NumberField name="maxCt" label="Max, exclusive" unit="ct" defaultValue={size?.max_ct} />
        <NumberField name="nominalCt" label="Nominal" unit="ct" defaultValue={size?.nominal_ct} placeholder="Blank = midpoint" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="lengthMm" label="Length" unit="mm" defaultValue={size?.lengthMm} placeholder="Blank = estimate" />
        <NumberField name="widthMm" label="Width" unit="mm" defaultValue={size?.widthMm} placeholder="Blank = estimate" />
      </div>
      <Field>
        <FieldLabel htmlFor="notes">Notes</FieldLabel>
        <Input id="notes" name="notes" defaultValue={size?.notes ?? ''} placeholder="e.g. sieve +2.5-3" />
      </Field>
    </FormSheet>
  );
}

export function GenerateSizes({ shapes }: { shapes: Shape[] }) {
  const offered = shapes.filter((s) => s.lengthMm !== null);
  return (
    <FormSheet
      trigger={<Button variant="outline" />} label="Generate standard sizes" title="Generate standard sizes" submit="Generate"
      description="40 sizes per shape: 0.05 to 2.00 ct in 0.05 ct steps, each covering the carats halfway to its neighbours (RD-100 = 0.975 to under 1.025 ct). Sizes that already exist are not changed. Melee bands below 0.05 ct are added one by one."
      action={generateSizesAction}
    >
      <div className="grid grid-cols-2 gap-2">
        {offered.map((s) => (
          <Label key={s.shape} className="font-normal">
            <Checkbox name="shape" value={s.shape} defaultChecked />
            {s.shape}
          </Label>
        ))}
      </div>
      {offered.length < shapes.length && (
        <FieldDescription>Shapes without a 1 ct size are left out: set it under Shapes first.</FieldDescription>
      )}
    </FormSheet>
  );
}
