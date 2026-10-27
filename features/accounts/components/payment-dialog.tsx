'use client';

import { DateField } from '@/components/forms/date-field';
import { Choice } from '@/components/forms/choice';
import { useState } from 'react';
import { useFormAction } from '@/lib/use-form-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { recordPaymentAction } from '../actions';
import { todayIso } from '@/lib/dates';

export function PaymentDialog({
  partyId, partyName, direction, billNo, outstanding, label, size = 'default', variant,
}: {
  partyId: string; partyName: string; direction: 'in' | 'out';
  billNo?: string | null; outstanding?: number; label?: string;
  size?: 'default' | 'sm';
  /** Lists pass 'outline': a column of filled buttons is noise, not emphasis. */
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useFormAction(recordPaymentAction, () => setOpen(false));
  const today = todayIso();
  const received = direction === 'in';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size={size} variant={variant ?? (received ? 'default' : 'outline')} />}>
        {label ?? (received ? 'Record receipt' : 'Record payment')}
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{received ? 'Money received' : 'Money paid'}</SheetTitle>
          <SheetDescription>
            {partyName}
            {billNo
              ? ` · against bill ${billNo}${
                  outstanding !== undefined ? ` (₹${outstanding.toLocaleString('en-IN')} outstanding)` : ''
                }`
              : ' · on account, not tied to one bill'}
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="partyId" value={partyId} />
          <input type="hidden" name="direction" value={direction} />
          {billNo && <input type="hidden" name="billNo" value={billNo} />}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`amt-${partyId}-${direction}`}>Amount (₹)</FieldLabel>
              <Input
                id={`amt-${partyId}-${direction}`} name="amount" type="number" step="0.01"
                min="0.01" required defaultValue={outstanding ? outstanding.toFixed(2) : ''}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`on-${partyId}-${direction}`}>Date</FieldLabel>
              <DateField id={`on-${partyId}-${direction}`} name="on" defaultValue={today} required />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor={`mode-${partyId}-${direction}`}>Mode</FieldLabel>
            <Choice
              id={`mode-${partyId}-${direction}`} name="mode" defaultValue="bank"
              options={[
                { value: 'bank', label: 'Bank transfer' }, { value: 'cash', label: 'Cash' },
                { value: 'upi', label: 'UPI' }, { value: 'cheque', label: 'Cheque' },
                { value: 'adjustment', label: 'Adjustment / set-off' }, { value: 'other', label: 'Other' },
              ]}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={`note-${partyId}-${direction}`}>Reference / note</FieldLabel>
            <Input
              id={`note-${partyId}-${direction}`} name="notes"
              placeholder="UTR, cheque no., or what it settles"
            />
          </Field>

          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : received ? 'Record receipt' : 'Record payment'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
