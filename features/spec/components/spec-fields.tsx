'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Choice } from '@/components/forms/choice';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { hides, isCertified, REQUIRED, SPEC_FIELDS, type Grades, type SpecField } from '@/lib/spec-rules';
import type { SizeOption } from '@/features/masters/sizes/queries';

export type SpecValue = Record<SpecField, string>;
/** What the pickers offer, loaded on the server by getSpecOptions(). */
export type SpecOptions = { sizes: SizeOption[]; grades: Grades };

/**
 * Nothing is pre-selected. The lists used to open on their first value, which
 * is why every parcel in the book came out "Lab Grown / Round" -- the picker
 * answered for the operator instead of asking.
 */
export const blankSpec = (): SpecValue => ({
  stoneType: '', sizeId: '', colour: '', clarity: '', certified: '', lab: '',
});

const LABEL: Record<SpecField, string> = {
  stoneType: 'Diamond type', sizeId: 'Size', colour: 'Colour', clarity: 'Clarity',
  certified: 'Certified', lab: 'Lab',
};

/**
 * The fields that name a stone: type, size, colour, clarity, certification.
 * Every one is a picker over the master, never free text. The size comes from the chart and
 * carries the shape with it; the lab appears once the stone is certified.
 *
 * Uncontrolled by default (drop it in a form and read FormData). Pass
 * `value`/`onChange` to drive it, which the multi-line sales form does.
 */
export function SpecFields({ id, options: { sizes, grades }, value, onChange, className }: {
  id: string; options: SpecOptions;
  value?: SpecValue; onChange?: (v: SpecValue) => void; className?: string;
}) {
  const [own, setOwn] = useState<SpecValue>(() => value ?? blankSpec());
  const spec = value ?? own;

  const set = (k: SpecField, v: string) => {
    const next = { ...spec, [k]: v };
    if (k === 'certified' && !isCertified(v)) next.lab = '';
    (onChange ?? setOwn)(next);
  };

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {SPEC_FIELDS.map((f) => {
        if (hides(spec, f)) return null;
        const required = REQUIRED.includes(f) || f === 'lab';
        const options = f === 'sizeId'
          ? sizes.map((s) => ({ value: s.id, label: s.label }))
          : grades[f].map((v) => ({ value: v.name, label: v.name }));
        return (
          <Field key={f}>
            <FieldLabel htmlFor={`${id}-${f}`}>
              {LABEL[f]}
              {required && <span className="text-destructive"> *</span>}
            </FieldLabel>
            <Choice
              id={`${id}-${f}`} name={f} searchable={f === 'sizeId'}
              value={spec[f]} onValueChange={(v) => set(f, v)} required={required}
              options={options}
            />
            {f === 'sizeId' && !sizes.length && (
              <FieldDescription>
                No sizes yet: add them in <Link href="/masters/diamonds" className="underline">Masters → Sizes</Link>.
              </FieldDescription>
            )}
          </Field>
        );
      })}
    </div>
  );
}
