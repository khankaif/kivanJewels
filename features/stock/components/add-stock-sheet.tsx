'use client';

import { AgentField } from '@/components/forms/agent-field';
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
import { Segmented } from '@/components/forms/segmented';
import { CaratsRate } from '@/components/forms/carats-rate';
import { SpecFields, blankSpec, type Picklists, type SpecValue } from '@/features/masters/diamonds/components/spec-fields';
import { QuickEntry } from '@/components/forms/quick-entry';
import type { SieveShapes } from '@/lib/spec-rules';
import { useLastUsed } from '@/lib/use-last-used';
import { addStockAction } from '../actions';
import { todayIso } from '@/lib/dates';

type Party = { id: string; name: string; defaultTermsDays: number };
type Mode = 'bill' | 'memo';

export function AddStockSheet({
  suppliers, agents, picklists, sieveShapes, defaultOpen = false,
}: {
  suppliers: Party[]; agents: string[];
  picklists: Picklists; sieveShapes: SieveShapes;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>('bill');
  const [terms, setTerms] = useState(7);
  const [supplier, setSupplier] = useLastUsed('stock.supplier');
  // Bumped after a "save & add another" so the form clears its own fields
  // while supplier, date and mode stay put -- the next parcel from the same
  // supplier usually differs only in size and carats.
  const [round, setRound] = useState(0);
  // Held here, not in the fields, so a quick-entry line can fill them.
  const [spec, setSpec] = useState<SpecValue>(blankSpec);
  const [fill, setFill] = useState({ n: 0, carats: '', rate: '' });
  const [state, formAction, isPending] = useFormAction(addStockAction, (fd) => {
    setSpec(blankSpec());
    setFill((f) => ({ n: f.n + 1, carats: '', rate: '' }));
    if (fd.get('then') === 'again') setRound((r) => r + 1);
    else setOpen(false);
  });
  const today = todayIso();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add stock</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Receive stock</SheetTitle>
          <SheetDescription>
            {mode === 'bill'
              ? 'You own this stock now. Add the supplier bill to create a payable, or leave it blank for a cash purchase.'
              : 'You are holding this stock on supplier approval. It is available to show a client, but you do not own it yet.'}
          </SheetDescription>
        </SheetHeader>

        <Segmented
          value={mode} set={setMode}
          options={[['bill', 'Purchase / cash'], ['memo', 'Supplier approval']]}
        />

        <form key={round} action={formAction} className="flex flex-1 flex-col gap-4">
          <input type="hidden" name="mode" value={mode} />

          <QuickEntry
            id="as"
            onParsed={(r) => {
              setSpec((s) => ({ ...s, ...r.spec }));
              setFill((f) => ({
                n: f.n + 1,
                carats: r.carats !== null ? String(r.carats) : f.carats,
                rate: r.rate !== null ? String(r.rate) : f.rate,
              }));
            }}
          />

          <SpecFields id="as" picklists={picklists} sieveShapes={sieveShapes} value={spec} onChange={setSpec} />

          {/* Remounted by a quick-entry fill so its defaults take the parsed values. */}
          <CaratsRate key={fill.n} id="as" defaultCarats={fill.carats} defaultRate={fill.rate} />

          <Field>
            <FieldLabel htmlFor="as-on">{mode === 'bill' ? 'Date' : 'Received on'}</FieldLabel>
            <DateField id="as-on" name="on" defaultValue={today} required />
          </Field>

          <Field>
            <FieldLabel htmlFor="as-partyId">Supplier</FieldLabel>
            <Choice
              id="as-partyId" name="partyId" searchable
              required={mode === 'memo'}
              placeholder={mode === 'bill' ? 'Not recorded — search to add' : 'Search suppliers…'}
              value={supplier}
              onValueChange={(v) => {
                setSupplier(v);
                const p = suppliers.find((s) => s.id === v);
                if (p) setTerms(p.defaultTermsDays);
              }}
              options={suppliers.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>

          {mode === 'bill' ? (
            <Field>
              <FieldLabel htmlFor="as-billNo">Bill no.</FieldLabel>
              <Input id="as-billNo" name="billNo" placeholder="Blank = cash, no payable" />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="as-memoNo">Memo no.</FieldLabel>
                <Input id="as-memoNo" name="memoNo" placeholder="Blank = we number it" />
              </Field>
              <Field>
                <FieldLabel htmlFor="as-terms">Terms (days)</FieldLabel>
                <Input
                  id="as-terms" name="termsDays" type="number" min="0" max="365"
                  value={terms} onChange={(e) => setTerms(Number(e.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="as-agent">Placed by</FieldLabel>
                <AgentField id="as-agent" agents={agents} />
              </Field>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="as-notes">Note</FieldLabel>
            <Input id="as-notes" name="notes" placeholder="Optional" />
          </Field>

          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
          )}

          <SheetFooter>
            <Button type="submit" name="then" value="again" variant="outline" disabled={isPending}>
              Save &amp; add another
            </Button>
            <Button type="submit" name="then" value="close" disabled={isPending}>
              {isPending ? 'Saving…' : mode === 'bill' ? 'Receive owned stock' : 'Receive on approval'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

