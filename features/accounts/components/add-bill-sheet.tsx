'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DateField } from '@/components/forms/date-field';
import { Choice } from '@/components/forms/choice';
import { toast } from 'sonner';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Segmented } from '@/components/forms/segmented';
import { Amount } from '@/components/forms/carats-rate';
import {
  SpecFields, blankSpec, type Picklists, type SpecValue,
} from '@/features/masters/diamonds/components/spec-fields';
import type { SieveShapes } from '@/lib/spec-rules';
import { useLastUsed } from '@/lib/use-last-used';
import { inr } from '@/lib/format';
import { addDays, todayIso } from '@/lib/dates';
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
  const today = todayIso();
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
        toast.success(res.ok);
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

          <Field>
            <FieldLabel htmlFor="ab-party">{direction === 'sale' ? 'Customer' : 'Supplier'}</FieldLabel>
            <Choice
              id="ab-party" name="partyId" required searchable placeholder="Search parties…"
              value={party}
              onValueChange={(v) => {
                setParty(v);
                const p = parties.find((x) => x.id === v);
                if (p) applyTerms(p.defaultTermsDays);
              }}
              options={parties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="ab-billNo">{direction === 'sale' ? 'Invoice no.' : "Supplier's bill no."}</FieldLabel>
              <Input
                id="ab-billNo" name="billNo" required={direction === 'purchase'}
                placeholder={direction === 'sale' ? 'Blank = we number it' : 'As printed on their bill'}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ab-on">Bill date</FieldLabel>
              <DateField
                id="ab-on" name="on" required
                value={on} onChange={(v) => { setOn(v); setDueOn(addDays(v, terms)); }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="ab-terms">Terms (days)</FieldLabel>
              <Input
                id="ab-terms" type="number" min="0" max="365"
                value={terms} onChange={(e) => applyTerms(Number(e.target.value))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ab-dueOn">Payment due</FieldLabel>
              <DateField id="ab-dueOn" name="dueOn" value={dueOn} onChange={setDueOn} />
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
              <Card key={i} size="sm"><CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Line {i + 1}</span>
                  {lines.length > 1 && (
                    <Button
                      type="button" variant="ghost" size="xs" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                      className="hover:text-destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>

                {withGoods && direction === 'sale' && (
                  <Choice
                    value={l.lotId} onValueChange={(v) => set(i, { lotId: v })}
                    required searchable placeholder="Search stock…"
                    options={units.map((u) => ({ value: u.lotId, label: `${u.label} — ${u.balance.toFixed(2)} ct` }))}
                  />
                )}

                {withGoods && direction === 'purchase' && (
                  <SpecFields
                    id={`ab-${i}`} picklists={picklists} sieveShapes={sieveShapes}
                    value={l.spec} onChange={(spec) => set(i, { spec })}
                  />
                )}

                {withGoods ? (
                  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                    <Field>
                      <FieldLabel htmlFor={`ab-${i}-carats`}>Carats</FieldLabel>
                      <Input
                        id={`ab-${i}-carats`} type="number" step="0.001" min="0.001" required
                        value={l.carats} onChange={(e) => set(i, { carats: e.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`ab-${i}-rate`}>Rate (₹/ct)</FieldLabel>
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
                    <Field>
                      <FieldLabel htmlFor={`ab-${i}-amount`}>Amount (₹)</FieldLabel>
                      <Input
                        id={`ab-${i}-amount`} type="number" step="0.01" min="0.01" required
                        value={l.amount} onChange={(e) => set(i, { amount: e.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`ab-${i}-notes`}>What for</FieldLabel>
                      <Input
                        id={`ab-${i}-notes`} placeholder="Freight, brokerage…"
                        value={l.notes} onChange={(e) => set(i, { notes: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
              </CardContent></Card>
            ))}
          </div>

          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bill total</span>
            <span className="text-base font-bold tabular-nums">{inr(total)}</span>
          </div>

          <Field>
            <FieldLabel htmlFor="ab-notes">Note</FieldLabel>
            <Input id="ab-notes" name="notes" placeholder="Optional" />
          </Field>

          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
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

