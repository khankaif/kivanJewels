'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
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
import { addDays } from '@/lib/dates';
import { ct, inr } from '@/lib/format';
import { createSaleAction, stockForSpecAction, type ActionState } from '../actions';
import type { SellableUnit } from '../queries';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

type Party = { id: string; name: string; defaultTermsDays: number };

/**
 * A line is one of two things, and the form asks which first: goods you are
 * taking off the shelf, or goods you have to buy in. Off the shelf you pick
 * the actual parcel and type no spec at all; to source, you describe the stone
 * and say who is getting it for you.
 */
type Line = {
  from: 'stock' | 'source';
  lotId: string;
  spec: SpecValue;
  carats: string; quotedRate: string; costRate: string;
  /** Only for a sourced line: how much of this spec happens to be on the shelf. */
  inStock: number | null;
};

const blankLine = (): Line => ({
  from: 'stock', lotId: '', spec: blankSpec(),
  carats: '', quotedRate: '', costRate: '', inStock: null,
});

const num = (v: string) => Number(v) || 0;

export function NewSaleSheet({
  customers, suppliers, agents, picklists, sieveShapes, units, defaultOpen = false,
}: {
  customers: Party[]; suppliers: Party[]; agents: string[];
  picklists: Picklists; sieveShapes: SieveShapes; units: SellableUnit[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [customer, setCustomer] = useLastUsed('sales.customer');
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const today = new Date().toISOString().slice(0, 10);
  const [raisedOn, setRaisedOn] = useState(today);

  const [deliverNow, setDeliverNow] = useState(false);
  const [channel, setChannel] = useState<'memo' | 'bill'>('memo');
  const [sourceNow, setSourceNow] = useState(false);
  const [sourceChannel, setSourceChannel] = useState<'memo' | 'bill'>('memo');
  const [terms, setTerms] = useState(7);

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      fd.set('lines', JSON.stringify(
        lines.filter((l) => num(l.carats) > 0).map((l) => {
          const want = num(l.carats);
          // A picked parcel can be short: whatever it cannot cover is sourced,
          // which is the split the old form made you work out by hand.
          const fromStock = l.from === 'stock' ? Math.min(want, unitBalance(units, l.lotId)) : 0;
          return {
            lotId: l.from === 'stock' ? l.lotId : undefined,
            ...(l.from === 'source' ? l.spec : {}),
            carats: want,
            quotedRate: l.quotedRate ? num(l.quotedRate) : null,
            costRate: l.costRate ? num(l.costRate) : null,
            planStock: fromStock,
            planSource: Number((want - fromStock).toFixed(3)),
          };
        }),
      ));
      const res = await createSaleAction(prev, fd);
      if (res && 'ok' in res) {
        setOpen(false);
        setLines([blankLine()]);
        setDeliverNow(false);
        setSourceNow(false);
      }
      return res;
    },
    null,
  );

  const set = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const planOf = (l: Line) => {
    const want = num(l.carats);
    const stock = l.from === 'stock' ? Math.min(want, unitBalance(units, l.lotId)) : 0;
    return { stock, source: want - stock };
  };
  const totalStock = lines.reduce((s, l) => s + planOf(l).stock, 0);
  const totalSource = lines.reduce((s, l) => s + planOf(l).source, 0);
  const totalValue = lines.reduce((s, l) => s + num(l.carats) * num(l.quotedRate), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>New sale</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Start a customer order</SheetTitle>
          <SheetDescription>
            Add what the customer wants. The system checks your live stock and suggests what must be sourced.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <section className="space-y-3 rounded-xl border bg-muted/25 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">1 · Customer</p>
            <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="ns-party">Customer</FieldLabel>
              <NativeSelect
                id="ns-party" name="partyId" required autoFocus
                className="w-full"
                value={customer} onChange={(e) => setCustomer(e.target.value)}
              >
                <NativeSelectOption value="">Select…</NativeSelectOption>
                {customers.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="ns-date">Raised on</FieldLabel>
              <Input
                id="ns-date" name="raisedOn" type="date" required
                value={raisedOn} onChange={(e) => setRaisedOn(e.target.value)}
              />
            </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="ns-agent">Placed by</FieldLabel>
              <Input id="ns-agent" name="agent" list="ns-agents" placeholder="Rushabh" />
              <datalist id="ns-agents">{agents.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <Field>
              <FieldLabel htmlFor="ns-notes">Note</FieldLabel>
              <Input id="ns-notes" name="notes" placeholder="Optional" />
            </Field>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">2 · Stones requested</p>
                <p className="text-xs text-muted-foreground">Add each size/specification as a separate line.</p>
              </div>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setLines((l) => [...l, blankLine()])}
              >
                Add line
              </Button>
            </div>

            {lines.map((l, i) => (
              <LineCard
                key={i} index={i} line={l} picklists={picklists} sieveShapes={sieveShapes}
                units={units} sourceNow={sourceNow}
                onChange={(patch) => set(i, patch)}
                onRemove={lines.length > 1 ? () => setLines((ls) => ls.filter((_, j) => j !== i)) : undefined}
              />
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border bg-muted/35 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">
              From stock <span className="font-medium text-foreground tabular-nums">{ct(totalStock)}</span>
            </span>
            <span className="text-muted-foreground">
              To source <span className="font-medium text-foreground tabular-nums">{ct(totalSource)}</span>
            </span>
            <span className="ml-auto font-bold tabular-nums">{inr(totalValue)}</span>
          </div>

          <section className="space-y-3 rounded-xl border p-3.5">
            <div>
              <p className="text-sm font-semibold">3 · Act now or keep as a requirement</p>
              <p className="text-xs text-muted-foreground">Optional. You can complete either step later from the requirement.</p>
            </div>
          <Label>
            <Checkbox checked={deliverNow} onCheckedChange={setDeliverNow} />
            Send available stock to the customer now
          </Label>
          <input type="hidden" name="deliverNow" value={deliverNow ? '1' : ''} />

          {deliverNow && (
            <div className="space-y-3 rounded-lg border p-3">
              <input type="hidden" name="channel" value={channel} />
              <Segmented
                value={channel} set={setChannel}
                options={[['memo', 'On approval'], ['bill', 'Firm sale / invoice']]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="ns-doc">{channel === 'memo' ? 'Memo no.' : 'Invoice no.'}</FieldLabel>
                  <Input
                    id="ns-doc" name={channel === 'memo' ? 'memoNo' : 'invoiceNo'}
                    placeholder="Blank = we number it"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ns-dueOn">{channel === 'memo' ? 'Due back' : 'Payment due'}</FieldLabel>
                  <Input id="ns-dueOn" name="dueOn" type="date" defaultValue={addDays(raisedOn, 7)} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Carats come off owned stock first, then goods held on a supplier memo. Pick lots by
                hand from the requirement page if this sale needs a particular parcel.
              </p>
            </div>
          )}

          <Label>
            <Checkbox checked={sourceNow} onCheckedChange={setSourceNow} />
            Receive the sourced quantity from a supplier now
          </Label>
          <input type="hidden" name="sourceNow" value={sourceNow ? '1' : ''} />

          {sourceNow && (
            <div className="space-y-3 rounded-lg border p-3">
              <input type="hidden" name="sourceChannel" value={sourceChannel} />
              <Field>
                <FieldLabel htmlFor="ns-supplier">Supplier</FieldLabel>
                <NativeSelect
                  id="ns-supplier" name="supplierId" required
                  className="w-full"
                  onChange={(e) => {
                    const p = suppliers.find((x) => x.id === e.target.value);
                    if (p) setTerms(p.defaultTermsDays);
                  }}
                >
                  <NativeSelectOption value="">Select…</NativeSelectOption>
                  {suppliers.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Segmented
                value={sourceChannel} set={setSourceChannel}
                options={[['memo', 'On supplier approval'], ['bill', 'Purchase bill']]}
              />
              <div className="grid grid-cols-2 gap-3">
                {sourceChannel === 'memo' ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="ns-srcDoc">Memo no.</FieldLabel>
                      <Input id="ns-srcDoc" name="sourceMemoNo" placeholder="Blank = we number it" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ns-terms">Terms (days)</FieldLabel>
                      <Input
                        id="ns-terms" name="termsDays" type="number" min="0" max="365"
                        value={terms} onChange={(e) => setTerms(Number(e.target.value))}
                      />
                    </Field>
                  </>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="ns-srcDoc">Bill no.</FieldLabel>
                    <Input id="ns-srcDoc" name="billNo" placeholder="Blank = cash" />
                  </Field>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                One supplier per save. Split a line across several suppliers from the requirement
                page.
              </p>
            </div>
          )}

          </section>

          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
          )}

          <SheetFooter className="sticky bottom-0 -mx-5 border-t bg-popover px-5 py-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : deliverNow || sourceNow ? 'Save order & actions' : 'Save requirement'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Carats a picked parcel still holds, 0 when nothing is picked. */
const unitBalance = (units: SellableUnit[], lotId: string) =>
  units.find((u) => u.lotId === lotId)?.balance ?? 0;

/**
 * One line, and the first question is where the goods come from.
 *
 * Off the shelf you pick the parcel itself, so the spec is whatever that
 * parcel already is -- nothing to retype and no second spelling of a stone
 * that already exists. To source, you describe the stone and the form checks
 * the shelf while you type, in case you are about to buy what you already own.
 */
function LineCard({
  index, line, picklists, sieveShapes, units, sourceNow, onChange, onRemove,
}: {
  index: number; line: Line; picklists: Picklists; sieveShapes: SieveShapes;
  units: SellableUnit[]; sourceNow: boolean;
  onChange: (patch: Partial<Line>) => void; onRemove?: () => void;
}) {
  const { spec, carats } = line;
  const fromStock = line.from === 'stock';
  const picked = units.find((u) => u.lotId === line.lotId);
  const key = [spec.shape, spec.sieveSize, spec.mmSize, spec.colour, spec.clarity].join('|');

  // Sourced lines ask the shelf what it holds, a beat after typing stops.
  useEffect(() => {
    if (fromStock || (!spec.sieveSize && !spec.mmSize)) {
      onChange({ inStock: null });
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const res = await stockForSpecAction(spec);
      if (live) onChange({ inStock: res.inStock });
    }, 350);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fromStock]);

  const want = num(carats);
  const short = fromStock && picked ? want - picked.balance : 0;

  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-[0.1em]">Stone {index + 1}</span>
          {onRemove && (
            <Button type="button" variant="ghost" size="xs" onClick={onRemove} className="hover:text-destructive">Remove</Button>
          )}
        </div>

        <Segmented
          value={line.from}
          set={(v) => onChange({ from: v, lotId: '', inStock: null })}
          options={[['stock', 'From stock'], ['source', 'To source']]}
        />

        {fromStock ? (
          <>
            <Field>
              <FieldLabel htmlFor={`ns-${index}-lot`}>Which parcel</FieldLabel>
              <NativeSelect
                id={`ns-${index}-lot`} required
                className="w-full"
                value={line.lotId}
                onChange={(e) => {
                  const u = units.find((x) => x.lotId === e.target.value);
                  onChange({
                    lotId: e.target.value,
                    // Selling the whole parcel is the common case; overwrite only
                    // while the operator has not typed carats of their own.
                    carats: carats || (u ? u.balance.toFixed(3) : ''),
                  });
                }}
              >
                <NativeSelectOption value="">Select stock…</NativeSelectOption>
                {units.map((u) => (
                  <NativeSelectOption key={u.lotId} value={u.lotId}>
                    {u.label} — {u.balance.toFixed(3)} ct{u.onMemo ? ` (on memo${u.partyName ? `, ${u.partyName}` : ''})` : ''}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {picked && (
              <p className="text-xs text-muted-foreground">
                {ct(picked.balance)} in this parcel
                {picked.costRate > 0 && ` · cost ${inr(picked.costRate)}/ct`}
                {picked.onMemo && ' · still the supplier\u2019s goods until billed'}
              </p>
            )}
          </>
        ) : (
          <SpecFields
            id={`ns-${index}`} picklists={picklists} sieveShapes={sieveShapes}
            value={spec} onChange={(v) => onChange({ spec: v })}
          />
        )}

        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
          <Field>
            <FieldLabel htmlFor={`ns-${index}-carats`}>Carats</FieldLabel>
            <Input
              id={`ns-${index}-carats`} type="number" step="0.001" min="0.001" required
              value={carats} onChange={(e) => onChange({ carats: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`ns-${index}-rate`}>Rate (₹/ct)</FieldLabel>
            <Input
              id={`ns-${index}-rate`} type="number" step="0.01" min="0"
              value={line.quotedRate} onChange={(e) => onChange({ quotedRate: e.target.value })}
            />
          </Field>
          <p className="pb-2 text-sm font-medium">
            <Amount carats={want} rate={num(line.quotedRate)} />
          </p>
        </div>

        {!fromStock && (
          <p className="text-xs">
            {line.inStock === null ? (
              <span className="text-muted-foreground">Choose a size to check live availability.</span>
            ) : line.inStock > 0.0005 ? (
              <span className="font-medium text-positive">
                {ct(line.inStock)} of this spec is already in stock — switch to From stock to use it
              </span>
            ) : (
              <span className="text-muted-foreground">Not in stock — this line gets sourced.</span>
            )}
          </p>
        )}

        {(!fromStock || short > 0.0005) && sourceNow && (
          <Field>
            <FieldLabel htmlFor={`ns-${index}-cost`}>Supplier cost (₹/ct)</FieldLabel>
            <Input
              id={`ns-${index}-cost`} type="number" step="0.01" min="0"
              value={line.costRate} onChange={(e) => onChange({ costRate: e.target.value })}
            />
          </Field>
        )}

        {short > 0.0005 && (
          <p className="text-xs text-warning">
            That parcel is {ct(short)} short — the rest of this line is sourced.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

