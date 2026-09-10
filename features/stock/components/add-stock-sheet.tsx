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
import { addStockAction, type ActionState } from '../actions';

type Party = { id: string; name: string; defaultTermsDays: number };
type Mode = 'bill' | 'memo';

export function AddStockSheet({
  suppliers, agents, shapes, colours, clarities, defaultOpen = false,
}: {
  suppliers: Party[]; agents: string[];
  shapes: string[]; colours: string[]; clarities: string[];
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
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await addStockAction(prev, fd);
      if (res && 'ok' in res) {
        if (fd.get('then') === 'again') setRound((r) => r + 1);
        else setOpen(false);
      }
      return res;
    },
    null,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add diamonds</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Add diamonds to stock</SheetTitle>
          <SheetDescription>
            {mode === 'bill'
              ? 'Bought outright — goes to purchase stock. A bill number posts a payable; leave it blank for a cash buy.'
              : 'Held on approval — goes to memo stock. No payable until the supplier bills you.'}
          </SheetDescription>
        </SheetHeader>

        <Segmented
          value={mode} set={setMode}
          options={[['bill', 'On bill / cash'], ['memo', 'On memo']]}
        />

        <form key={round} action={formAction} className="flex flex-1 flex-col gap-4">
          <input type="hidden" name="mode" value={mode} />

          <SpecFields id="as" shapes={shapes} colours={colours} clarities={clarities} autoFocus />

          <div className="grid grid-cols-3 gap-3">
            <Field label="Carats" htmlFor="as-carats">
              <Input id="as-carats" name="carats" type="number" step="0.001" min="0.001" required />
            </Field>
            <Field label="Rate (₹/ct)" htmlFor="as-rate">
              <Input id="as-rate" name="rate" type="number" step="0.01" min="0" required />
            </Field>
            <Field label={mode === 'bill' ? 'Date' : 'Received on'} htmlFor="as-on">
              <Input id="as-on" name="on" type="date" defaultValue={today} required />
            </Field>
          </div>

          <Field label="Supplier" htmlFor="as-partyId">
            <select
              id="as-partyId" name="partyId"
              required={mode === 'memo'}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                const p = suppliers.find((s) => s.id === e.target.value);
                if (p) setTerms(p.defaultTermsDays);
              }}
            >
              <option value="">{mode === 'bill' ? 'Not recorded' : 'Select…'}</option>
              {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          {mode === 'bill' ? (
            <Field label="Bill no." htmlFor="as-billNo">
              <Input id="as-billNo" name="billNo" placeholder="Blank = cash, no payable" />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Memo no." htmlFor="as-memoNo">
                <Input id="as-memoNo" name="memoNo" required placeholder="JGD-IN-2026-001" />
              </Field>
              <Field label="Terms (days)" htmlFor="as-terms">
                <Input
                  id="as-terms" name="termsDays" type="number" min="0" max="365"
                  value={terms} onChange={(e) => setTerms(Number(e.target.value))}
                />
              </Field>
              <Field label="Placed by" htmlFor="as-agent">
                <Input id="as-agent" name="agent" list="as-agent-list" placeholder="Rushabh" />
                <datalist id="as-agent-list">
                  {agents.map((a) => <option key={a} value={a} />)}
                </datalist>
              </Field>
            </div>
          )}

          <Field label="Note" htmlFor="as-notes">
            <Input id="as-notes" name="notes" placeholder="Optional" />
          </Field>

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          {state && 'ok' in state && (
            <p role="status" className="text-sm text-positive">{state.ok}</p>
          )}

          <SheetFooter>
            <Button type="submit" name="then" value="again" variant="outline" disabled={isPending}>
              Save &amp; add another
            </Button>
            <Button type="submit" name="then" value="close" disabled={isPending}>
              {isPending ? 'Saving…' : mode === 'bill' ? 'Add to purchase stock' : 'Add to memo stock'}
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
