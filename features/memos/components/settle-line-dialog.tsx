'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { settleLineAction, type ActionState } from '../actions';

export function SettleLineDialog({
  lineId, lotNo, outstanding, rate, action,
}: {
  lineId: string; lotNo: string; outstanding: number; rate: number; action: 'return' | 'bill';
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
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={isBill ? 'default' : 'outline'} />}>
        {isBill ? 'Bill' : 'Return'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isBill ? 'Bill carats' : 'Return carats to vault'}</DialogTitle>
          <DialogDescription>
            Lot {lotNo} · {outstanding.toFixed(3)} ct outstanding.{' '}
            {isBill
              ? 'Billing posts a receivable and moves no stock — the carats left the vault at issue.'
              : 'Returned carats re-enter the vault immediately.'}{' '}
            You can do this repeatedly until the line is settled.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="memoLineId" value={lineId} />
          <input type="hidden" name="action" value={action} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`c-${lineId}-${action}`}>Carats</Label>
              <Input
                id={`c-${lineId}-${action}`} name="carats" type="number" step="0.001"
                min="0.001" max={outstanding} defaultValue={outstanding.toFixed(3)} required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`d-${lineId}-${action}`}>Date</Label>
              <Input id={`d-${lineId}-${action}`} name="on" type="date" defaultValue={today} required />
            </div>
          </div>

          {isBill && (
            <div className="space-y-2">
              <Label htmlFor={`i-${lineId}`}>Invoice no.</Label>
              <Input id={`i-${lineId}`} name="invoiceNo" required placeholder="INV-2026-001" />
              <p className="text-xs text-muted-foreground">
                Rate ₹{rate.toLocaleString('en-IN')}/ct on this line.
              </p>
            </div>
          )}

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : isBill ? 'Bill' : 'Return'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
