'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { recordPurchaseAction, type ActionState } from '../actions';

type Party = { id: string; name: string };

export function PurchaseDialog({ suppliers, shapes }: { suppliers: Party[]; shapes: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await recordPurchaseAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add stock</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buy stock</DialogTitle>
          <DialogDescription>
            Goods you own from the moment they arrive. Carats join the existing unit for this
            shape, sieve and MM — the rate becomes the average of what you paid.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pu-stoneType">Type</Label>
              <Input id="pu-stoneType" name="stoneType" defaultValue="Lab Grown" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-shape">Shape</Label>
              <Input id="pu-shape" name="shape" list="pu-shape-list" defaultValue="Round" />
              <datalist id="pu-shape-list">
                {shapes.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-sieve">Sieve</Label>
              <Input id="pu-sieve" name="sieveSize" placeholder="8.5-9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-mm">MM</Label>
              <Input id="pu-mm" name="mmSize" placeholder="2.20" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pu-carats">Carats</Label>
              <Input id="pu-carats" name="carats" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-rate">Rate (₹/ct)</Label>
              <Input id="pu-rate" name="rate" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-on">Date</Label>
              <Input id="pu-on" name="on" type="date" defaultValue={today} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pu-partyId">Supplier</Label>
              <select
                id="pu-partyId" name="partyId"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Not recorded</option>
                {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-billNo">Bill no.</Label>
              <Input id="pu-billNo" name="billNo" placeholder="Blank = paid, no payable" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pu-notes">Note</Label>
            <Input id="pu-notes" name="notes" placeholder="Optional" />
          </div>

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Add stock'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
