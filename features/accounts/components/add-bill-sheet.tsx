'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Segmented } from '@/components/ui/segmented';
import { Amount } from '@/components/ui/carats-rate';
import {
  SpecFields, blankSpec, type Picklists, type SpecValue,
} from '@/features/masters/diamonds/components/spec-fields';
import type { SieveShapes } from '@/lib/spec-rules';
import { useLastUsed } from '@/lib/use-last-used';
import { inr } from '@/lib/format';
import { addDays } from '@/lib/dates';
import { addBillAction, type BillState } from '../actions';

type Party = { id: string; name: string; defaultTermsDays: number };
type Unit = { lotId: string; lotNo: string; label: string; balance: number };
type Direction = 'sale' | 'purchase';
type Goods = 'stock' | 'none';

type Line = {
  lotId: string; spec: SpecValue; carats: string; rate: string; amount: string; notes: string;
};

const blankLine = (): Line => ({
  lotId: '', spec: blankSpec(), carats: '', rate: '', amount: '', notes: '',
});

const lineTotal = (l: Line, withGoods: boolean) =>
  withGoods ? (Number(l.carats) || 0) * (Number(l.rate) || 0) : Number(l.amount) || 0;

export function AddBillSheet({
  clients, suppliers, units, picklists, sieveShapes, defaultOpen = false,
}: {
  clients: Party[]; suppliers: Party[]; units: Unit[];
  picklists: Picklists; sieveShapes: SieveShapes;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [direction, setDirection] = useState<Direction>('sale');
  const [goods, setGoods] = useState<Goods>('stock');
  const [party, setParty] = useLastUsed(`bill.party.${direction}`);
  const today = new Date().toISOString().slice(0, 10);
  const [on, setOn] = useState(today);
  const [terms, setTerms] = useState(7);
  const [dueOn, setDueOn] = useState(() => addDays(today, 7));
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [state, formAction, isPending] = useActionState<BillState, FormData>(
    async (prev, fd) => {
      fd.set('lines', JSON.stringify(lines.map((l) => ({
        lotId: l.lotId || undefined,
        spec: l.spec,
        carats: Number(l.carats) || 0,
        rate: Number(l.rate) || 0,
        amount: Number(l.amount) || 0,
        notes: l.notes || undefined,
      }))));
      const res = await addBillAction(prev, fd);
      if (res && 'ok' in res) {
        setOpen(false);
        setLines([blankLine()]);
      }
      return res;
    },
    null,
  );

  const parties = direction === 'sale' ? clients : suppliers;
  const withGoods = goods === 'stock';
  const total = lines.reduce((sum, l) => sum + lineTotal(l, withGoods), 0);

  // Terms belong to the relationship; the due date is what you chase, so it
  // stays editable after the terms fill it in.
  const applyTerms = (days: number, from = on) => {
    setTerms(days);
    setDueOn(addDays(from, days));
  };
  const set = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add bill</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-xl">
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
              value={party}
              onChange={(e) => {
                setParty(e.target.value);
                const p = parties.find((x) => x.id === e.target.value);
                if (p) applyTerms(p.defaultTermsDays);
              }}
            >
              <option value="">Select…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={direction === 'sale' ? 'Invoice no.' : "Supplier's bill no."} htmlFor="ab-billNo">
              <Input
                id="ab-billNo" name="billNo" required={direction === 'purchase'}
                placeholder={direction === 'sale' ? 'Blank = we number it' : 'As printed on their bill'}
              />
            </Field>
            <Field label="Bill date" htmlFor="ab-on">
              <Input
                id="ab-on" name="on" type="date" required
                value={on} onChange={(e) => { setOn(e.target.value); setDueOn(addDays(e.target.value, terms)); }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Terms (days)" htmlFor="ab-terms">
              <Input
                id="ab-terms" type="number" min="0" max="365"
                value={terms} onChange={(e) => applyTerms(Number(e.target.value))}
              />
            </Field>
            <Field label="Payment due" htmlFor="ab-dueOn">
              <Input
                id="ab-dueOn" name="dueOn" type="date"
                value={dueOn} onChange={(e) => setDueOn(e.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {withGoods ? 'Lines' : 'Charges'}
              </span>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setLines((l) => [...l, blankLine()])}
              >
                Add line
              </Button>
            </div>

            {lines.map((l, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Line {i + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                      className="hover:text-destructive"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {withGoods && direction === 'sale' && (
                  <select
                    value={l.lotId} onChange={(e) => set(i, { lotId: e.target.value })}
                    required
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    <option value="">Select stock…</option>
                    {units.map((u) => (
                      <option key={u.lotId} value={u.lotId}>
                        {u.label} — {u.balance.toFixed(2)} ct
                      </option>
                    ))}
                  </select>
                )}

                {withGoods && direction === 'purchase' && (
                  <SpecFields
                    id={`ab-${i}`} picklists={picklists} sieveShapes={sieveShapes}
                    value={l.spec} onChange={(spec) => set(i, { spec })}
                  />
                )}

                {withGoods ? (
                  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                    <Field label="Carats" htmlFor={`ab-${i}-carats`}>
                      <Input
                        id={`ab-${i}-carats`} type="number" step="0.001" min="0.001" required
                        value={l.carats} onChange={(e) => set(i, { carats: e.target.value })}
                      />
                    </Field>
                    <Field label="Rate (₹/ct)" htmlFor={`ab-${i}-rate`}>
                      <Input
                        id={`ab-${i}-rate`} type="number" step="0.01" min="0" required
                        value={l.rate} onChange={(e) => set(i, { rate: e.target.value })}
                      />
                    </Field>
                    <p className="pb-2 text-sm font-medium">
                      <Amount carats={Number(l.carats)} rate={Number(l.rate)} />
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Amount (₹)" htmlFor={`ab-${i}-amount`}>
                      <Input
                        id={`ab-${i}-amount`} type="number" step="0.01" min="0.01" required
                        value={l.amount} onChange={(e) => set(i, { amount: e.target.value })}
                      />
                    </Field>
                    <Field label="What for" htmlFor={`ab-${i}-notes`}>
                      <Input
                        id={`ab-${i}-notes`} placeholder="Freight, brokerage…"
                        value={l.notes} onChange={(e) => set(i, { notes: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">Bill total</span>
            <span className="text-base font-bold tabular-nums">{inr(total)}</span>
          </div>

          <Field label="Note" htmlFor="ab-notes">
            <Input id="ab-notes" name="notes" placeholder="Optional" />
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
