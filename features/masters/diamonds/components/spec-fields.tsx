'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  hides, isCertified, SPEC_FIELDS, usesSieve, type SieveShapes, type SpecField,
} from '@/lib/spec-rules';

export type Picklists = Record<string, string[]>;
export type SpecValue = Record<SpecField, string>;

/**
 * Nothing is pre-selected. The lists used to open on their first value, which
 * is why every parcel in the book came out "Lab Grown / Round" -- the picker
 * answered for the operator instead of asking.
 */
export const blankSpec = (): SpecValue => ({
  stoneType: '', colour: '', clarity: '', shape: '',
  sieveSize: '', mmSize: '', certified: '', lab: '',
});

/** Which master list backs each field. Sieve and MM are measurements, not lists. */
const LIST_FOR: Partial<Record<SpecField, string>> = {
  stoneType: 'stone_type', colour: 'colour', clarity: 'clarity',
  shape: 'shape', certified: 'certified', lab: 'lab',
};
const LABEL: Record<SpecField, string> = {
  stoneType: 'Diamond type', colour: 'Colour', clarity: 'Clarity', shape: 'Shape',
  sieveSize: 'Sieve size', mmSize: 'MM', certified: 'Certified', lab: 'Lab',
};
const PLACEHOLDER: Partial<Record<SpecField, string>> = {
  sieveSize: '8.5-9', mmSize: '2.20',
};

/** Always asked for. The rest depend on the shape or on certification. */
const REQUIRED_FIELDS: SpecField[] = ['stoneType', 'shape', 'certified'];

/**
 * The fields that name a stone, in the order one is described: type, colour,
 * clarity, shape, size, then certification.
 *
 * Two things are enforced here rather than trusted. Values for every listed
 * field come from the master -- a select, not free text, so the book cannot
 * grow a seventh spelling of "Lab Grown". And which fields apply is a masters
 * rule: a sieve size is Round-only, so picking Oval greys it out and drops the
 * value rather than letting it into the unit key. The lab appears only once
 * the stone is marked certified.
 *
 * Uncontrolled by default (drop it in a form and read FormData). Pass
 * `value`/`onChange` to drive it, which the multi-line sales form does.
 */
export function SpecFields({
  id, picklists, sieveShapes, autoFocus = false, value, onChange, className,
}: {
  id: string; picklists: Picklists; sieveShapes: SieveShapes; autoFocus?: boolean;
  value?: SpecValue; onChange?: (v: SpecValue) => void; className?: string;
}) {
  const [own, setOwn] = useState<SpecValue>(() => value ?? blankSpec());
  const spec = value ?? own;

  const set = (k: SpecField, v: string) => {
    const next = { ...spec, [k]: v };
    // A shape change can retire a field; clear it so a stale sieve never
    // reaches the server or the unit key.
    // A shape that is measured in mm has no sieve; clear it so a stale value
    // never reaches the server or the unit key.
    if (k === 'shape' && !usesSieve(sieveShapes, v)) next.sieveSize = '';
    if (k === 'certified' && !isCertified(v)) next.lab = '';
    (onChange ?? setOwn)(next);
  };

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {SPEC_FIELDS.map((f, i) => {
        const listKey = LIST_FOR[f];
        const options = listKey ? picklists[listKey] ?? [] : null;
        const hidden = hides(sieveShapes, spec, f);
        // A lab only exists once a stone is certified, so the field appears
        // with the answer rather than sitting there greyed out.
        if (hidden && f === 'lab') return null;
        const required = REQUIRED_FIELDS.includes(f)
          || (f === 'lab' && isCertified(spec.certified))
          || (f === 'sieveSize' && !hidden)
          || (f === 'mmSize' && hides(sieveShapes, spec, 'sieveSize'));

        return (
          <div key={f} className="space-y-2">
            <Label htmlFor={`${id}-${f}`} className={cn(hidden && 'text-muted-foreground/60')}>
              {LABEL[f]}
              {required && <span className="text-destructive"> *</span>}
            </Label>
            {options ? (
              <select
                id={`${id}-${f}`} name={f}
                value={spec[f]} onChange={(e) => set(f, e.target.value)}
                disabled={hidden} required={required}
                autoFocus={autoFocus && i === 0}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm disabled:opacity-50"
              >
                <option value="">{hidden ? `not used for ${spec.shape}` : 'Select…'}</option>
                {options.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <Input
                id={`${id}-${f}`} name={f}
                value={spec[f]} onChange={(e) => set(f, e.target.value)}
                disabled={hidden} required={required}
                placeholder={hidden ? `not used for ${spec.shape}` : PLACEHOLDER[f]}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
