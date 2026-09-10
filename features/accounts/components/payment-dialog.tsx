'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { recordPaymentAction, type PaymentState } from '../actions';

export function PaymentDialog({
  partyId, partyName, direction, billNo, outstanding, label, size = 'default',
}: {
  partyId: string; partyName: string; direction: 'in' | 'out';
  billNo?: string | null; outstanding?: number; label?: string;
  size?: 'default' | 'sm';
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<PaymentState, FormData>(
    async (prev, fd) => {
      const res = await recordPaymentAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );
  const today = new Date().toISOString().slice(0, 10);
  const received = direction === 'in';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size={size} variant={received ? 'default' : 'outline'} />}>
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
            <div className="space-y-2">
              <Label htmlFor={`amt-${partyId}-${direction}`}>Amount (₹)</Label>
              <Input
                id={`amt-${partyId}-${direction}`} name="amount" type="number" step="0.01"
                min="0.01" required defaultValue={outstanding ? outstanding.toFixed(2) : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`on-${partyId}-${direction}`}>Date</Label>
              <Input
                id={`on-${partyId}-${direction}`} name="on" type="date"
                defaultValue={today} required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`mode-${partyId}-${direction}`}>Mode</Label>
            <select
              id={`mode-${partyId}-${direction}`} name="mode" defaultValue="bank"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="bank">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="adjustment">Adjustment / set-off</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`note-${partyId}-${direction}`}>Reference / note</Label>
            <Input
              id={`note-${partyId}-${direction}`} name="notes"
              placeholder="UTR, cheque no., or what it settles"
            />
          </div>

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
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
