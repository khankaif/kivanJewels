'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Segmented } from '@/components/ui/segmented';
import { SpecFields } from '@/features/masters/diamonds/components/spec-fields';
import { useLastUsed } from '@/lib/use-last-used';
import { addBillAction, type BillState } from '../actions';

type Party = { id: string; name: string };
type Unit = { lotId: string; lotNo: string; label: string; balance: number };
type Direction = 'sale' | 'purchase';
type Goods = 'stock' | 'none';

export function AddBillSheet({
  clients, suppliers, units, shapes, colours, clarities, defaultOpen = false,
}: {
  clients: Party[]; suppliers: Party[]; units: Unit[];
  shapes: string[]; colours: string[]; clarities: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [direction, setDirection] = useState<Direction>('sale');
  const [goods, setGoods] = useState<Goods>('stock');
  const [party, setParty] = useLastUsed(`bill.party.${direction}`);
  const [state, formAction, isPending] = useActionState<BillState, FormData>(
    async (prev, fd) => {
      const res = await addBillAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );

  const today = new Date().toISOString().slice(0, 10);
  const parties = direction === 'sale' ? clients : suppliers;
  const withGoods = goods === 'stock';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add bill</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add a bill</SheetTitle>
          <SheetDescription>
            {withGoods
              ? direction === 'sale'
                ? 'A firm sale off your stock. The carats leave stock and the customer owes you.'
                : 'Diamonds bought on a bill. The carats enter stock and you owe the supplier.'
              : 'Charges with no diamonds behind them — brokerage, freight, certification, '
                + 'labour — or an older bill entered for the balance alone. No stock moves.'}
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="goods" value={goods} />

          <Segmented
            value={direction}
            set={(d) => { setDirection(d); if (d === 'purchase' && !withGoods) setGoods('none'); }}
            options={[['sale', 'I billed a customer'], ['purchase', 'A supplier billed me']]}
          />
          <Segmented
            value={goods} set={setGoods}
            options={[
              ['stock', direction === 'sale' ? 'From stock' : 'Into stock'],
              ['none', 'No diamonds'],
            ]}
          />

          <Field label={direction === 'sale' ? 'Customer' : 'Supplier'} htmlFor="ab-party">
            <select
              id="ab-party" name="partyId" required autoFocus
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={party} onChange={(e) => setParty(e.target.value)}
            >
              <option value="">Select…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Bill no." htmlFor="ab-billNo">
              <Input id="ab-billNo" name="billNo" required placeholder="INV-2026-014" />
            </Field>
            <Field label="Bill date" htmlFor="ab-on">
              <Input id="ab-on" name="on" type="date" defaultValue={today} required />
            </Field>
          </div>

          {withGoods && direction === 'sale' && (
            <Field label="From stock" htmlFor="ab-lot">
              <select
                id="ab-lot" name="lotId" required
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Select…</option>
                {units.map((u) => (
                  <option key={u.lotId} value={u.lotId}>
                    {u.label} — {u.balance.toFixed(2)} ct
                  </option>
                ))}
              </select>
            </Field>
          )}

          {withGoods && direction === 'purchase' && (
            <SpecFields id="ab" shapes={shapes} colours={colours} clarities={clarities} />
          )}

          {withGoods ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Carats" htmlFor="ab-carats">
                <Input id="ab-carats" name="carats" type="number" step="0.001" min="0.001" required />
              </Field>
              <Field label="Rate (₹/ct)" htmlFor="ab-rate">
                <Input id="ab-rate" name="rate" type="number" step="0.01" min="0" required />
              </Field>
            </div>
          ) : (
            <Field label="Amount (₹)" htmlFor="ab-amount">
              <Input id="ab-amount" name="amount" type="number" step="0.01" min="0.01" required />
            </Field>
          )}

          <Field label="Note" htmlFor="ab-notes">
            <Input id="ab-notes" name="notes" placeholder={withGoods ? 'Optional' : 'Freight, brokerage…'} />
          </Field>

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Record bill'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
