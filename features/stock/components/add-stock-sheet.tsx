'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { addStockAction, type ActionState } from '../actions';

type Party = { id: string; name: string; defaultTermsDays: number };
type Mode = 'bill' | 'memo';

export function AddStockSheet({
  suppliers, agents, shapes, colours, clarities,
}: {
  suppliers: Party[]; agents: string[];
  shapes: string[]; colours: string[]; clarities: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('bill');
  const [terms, setTerms] = useState(7);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await addStockAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
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

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['bill', 'memo'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'bill' ? 'On bill / cash' : 'On memo'}
            </button>
          ))}
        </div>

        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <input type="hidden" name="mode" value={mode} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="as-type">
              <Input id="as-type" name="stoneType" defaultValue="Lab Grown" />
            </Field>
            <Field label="Shape" htmlFor="as-shape">
              <Input id="as-shape" name="shape" list="as-shape-list" placeholder="Round" />
              <datalist id="as-shape-list">
                {shapes.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sieve" htmlFor="as-sieve">
              <Input id="as-sieve" name="sieveSize" placeholder="8.5-9" />
            </Field>
            <Field label="MM" htmlFor="as-mm">
              <Input id="as-mm" name="mmSize" placeholder="2.20" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Colour" htmlFor="as-colour">
              <Input id="as-colour" name="colour" list="as-colour-list" placeholder="EF" />
              <datalist id="as-colour-list">
                {colours.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Clarity" htmlFor="as-clarity">
              <Input id="as-clarity" name="clarity" list="as-clarity-list" placeholder="VVS-VS" />
              <datalist id="as-clarity-list">
                {clarities.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
          </div>

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
              onChange={(e) => {
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

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
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
