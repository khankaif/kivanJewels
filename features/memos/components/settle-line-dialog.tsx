'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { settleLineAction, type ActionState } from '../actions';

export function SettleLineDialog({
  lineId, lotNo, outstanding, rate, action, direction,
}: {
  lineId: string; lotNo: string; outstanding: number; rate: number;
  action: 'return' | 'bill'; direction: 'in' | 'out';
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await settleLineAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );
  const isBill = action === 'bill';
  const inward = direction === 'in';
  const today = new Date().toISOString().slice(0, 10);

  const title = isBill
    ? inward ? 'Record supplier bill' : 'Create customer invoice'
    : inward ? 'Return to supplier' : 'Receive client return';
  const explain = isBill
    ? inward
      ? 'Creates a payable and promotes the goods from consignment to owned stock. No carats move — they are already in your vault.'
      : 'Creates a receivable. No carats move — they left the vault when the memo was issued.'
    : inward
      ? 'Sends goods back to the supplier. Carats leave the vault, so anything already issued to a client cannot be returned.'
      : 'Carats re-enter your vault.';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant={isBill ? 'default' : 'outline'} />}>
        {isBill ? (inward ? 'Record bill' : 'Invoice') : 'Return'}
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Lot {lotNo} · {outstanding.toFixed(3)} ct outstanding. {explain} You can do this
            repeatedly until the line is settled.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="memoLineId" value={lineId} />
          <input type="hidden" name="action" value={action} />
          <input type="hidden" name="direction" value={direction} />

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`c-${lineId}-${action}`}>Carats</FieldLabel>
              <Input
                id={`c-${lineId}-${action}`} name="carats" type="number" step="0.001"
                min="0.001" max={outstanding} defaultValue={outstanding.toFixed(3)} required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`d-${lineId}-${action}`}>Date</FieldLabel>
              <Input id={`d-${lineId}-${action}`} name="on" type="date" defaultValue={today} required />
            </Field>
          </div>

          {isBill && (
            <Field>
              <FieldLabel htmlFor={`i-${lineId}`}>{inward ? 'Supplier bill no.' : 'Customer invoice no.'}</FieldLabel>
              <Input
                id={`i-${lineId}`} name="invoiceNo" required={inward}
                placeholder={inward ? "As printed on their bill" : 'Blank = we number it'}
              />
            </Field>
          )}

          {isBill && (
            <Field>
              <FieldLabel htmlFor={`r-${lineId}`}>Rate (₹/ct)</FieldLabel>
              <Input
                id={`r-${lineId}`} name="rate" type="number" step="0.01" min="0"
                defaultValue={rate}
              />
              <FieldDescription>
                Memo rate was ₹{rate.toLocaleString('en-IN')}/ct. Override if the
                {inward ? ' supplier invoiced' : ' client is billed'} at a different rate.
              </FieldDescription>
            </Field>
          )}

          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : isBill ? (inward ? 'Record supplier bill' : 'Create invoice') : 'Confirm return'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
