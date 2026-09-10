'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { useLastUsed } from '@/lib/use-last-used';
import { createRequirementAction, type ActionState } from '../actions';

type Party = { id: string; name: string };
type Line = {
  stoneType: string; shape: string; sieveSize: string; mmSize: string;
  colour: string; clarity: string; carats: string; quotedRate: string;
};

const blank = (): Line => ({
  stoneType: 'Lab Grown', shape: 'Round', sieveSize: '', mmSize: '',
  colour: '', clarity: '', carats: '', quotedRate: '',
});

export function RequirementForm({
  customers, agents, shapes, colours, clarities, defaultOpen = false,
}: {
  customers: Party[]; agents: string[];
  shapes: string[]; colours: string[]; clarities: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [customer, setCustomer] = useLastUsed('sales.customer');
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      fd.set('lines', JSON.stringify(
        lines
          .filter((l) => l.carats)
          .map((l) => ({
            ...l,
            carats: Number(l.carats),
            quotedRate: l.quotedRate ? Number(l.quotedRate) : null,
          })),
      ));
      const res = await createRequirementAction(prev, fd);
      if (res && 'ok' in res) {
        setOpen(false);
        setLines([blank()]);
      }
      return res;
    },
    null,
  );
  const today = new Date().toISOString().slice(0, 10);
  const set = (i: number, k: keyof Line, v: string) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>New requirement</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Customer requirement</SheetTitle>
          <SheetDescription>
            What the customer asked for. Fulfil each line from stock or by sourcing later.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rq-party">Customer</Label>
              <select
                id="rq-party" name="partyId" required autoFocus
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={customer} onChange={(e) => setCustomer(e.target.value)}
              >
                <option value="">Select…</option>
                {customers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-date">Raised on</Label>
              <Input id="rq-date" name="raisedOn" type="date" defaultValue={today} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rq-agent">Placed by</Label>
              <Input id="rq-agent" name="agent" list="rq-agents" placeholder="Rushabh" />
              <datalist id="rq-agents">{agents.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-notes">Note</Label>
              <Input id="rq-notes" name="notes" placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Line items</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setLines((l) => [...l, blank()])}>
                Add line
              </Button>
            </div>

            {lines.map((l, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={l.shape} onChange={(e) => set(i, 'shape', e.target.value)}
                    list="rq-shapes" placeholder="Shape"
                    className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <input
                    value={l.sieveSize} onChange={(e) => set(i, 'sieveSize', e.target.value)}
                    placeholder="Sieve" className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <input
                    value={l.mmSize} onChange={(e) => set(i, 'mmSize', e.target.value)}
                    placeholder="MM" className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <input
                    value={l.colour} onChange={(e) => set(i, 'colour', e.target.value)}
                    list="rq-colours" placeholder="Colour"
                    className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <input
                    value={l.clarity} onChange={(e) => set(i, 'clarity', e.target.value)}
                    list="rq-clarities" placeholder="Clarity"
                    className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <input
                    value={l.stoneType} onChange={(e) => set(i, 'stoneType', e.target.value)}
                    placeholder="Type" className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <input
                    value={l.carats} onChange={(e) => set(i, 'carats', e.target.value)}
                    type="number" step="0.001" min="0" placeholder="Carats *"
                    className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <input
                    value={l.quotedRate} onChange={(e) => set(i, 'quotedRate', e.target.value)}
                    type="number" step="0.01" min="0" placeholder="Quoted ₹/ct"
                    className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                      className="h-8 rounded-md border text-sm text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <datalist id="rq-shapes">{shapes.map((s) => <option key={s} value={s} />)}</datalist>
          <datalist id="rq-colours">{colours.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="rq-clarities">{clarities.map((c) => <option key={c} value={c} />)}</datalist>

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Raise requirement'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
