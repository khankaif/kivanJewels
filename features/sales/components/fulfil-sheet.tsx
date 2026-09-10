'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { deliverAction, sourceAction, type ActionState } from '../actions';
import type { RequirementLine, SpecLot } from '../queries';

type Party = { id: string; name: string; defaultTermsDays: number };

function Toggle<T extends string>({ value, set, options }: {
  value: T; set: (v: T) => void; options: [T, string][];
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {options.map(([v, label]) => (
        <button
          key={v} type="button" onClick={() => set(v)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function FulfilSheet({
  line, stock, suppliers, agents,
}: {
  line: RequirementLine;
  stock: { exact: SpecLot[]; others: SpecLot[] };
  suppliers: Party[]; agents: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'deliver' | 'source'>(line.inStock > 0.0005 ? 'deliver' : 'source');
  const [channel, setChannel] = useState<'memo' | 'bill'>('memo');
  const [showAll, setShowAll] = useState(false);
  const [terms, setTerms] = useState(7);

  const run = mode === 'deliver' ? deliverAction : sourceAction;
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      fd.set('lineId', line.lineId);
      fd.set('channel', channel);
      const res = await run(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );

  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(new Date(today).getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const lots = showAll ? [...stock.exact, ...stock.others] : stock.exact;
  const specLabel = [line.sieveSize, line.mmSize && `${line.mmSize}mm`, line.shape, line.colour, line.clarity]
    .filter(Boolean).join(' · ');

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Fulfil</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Fulfil — {specLabel || 'line'}</SheetTitle>
          <SheetDescription>
            {line.outstanding.toFixed(3)} ct outstanding of {line.wanted.toFixed(3)}.
            {line.inStock > 0.0005 && ` ${line.inStock.toFixed(3)} ct of this spec in stock.`}
          </SheetDescription>
        </SheetHeader>

        <Toggle
          value={mode} set={setMode}
          options={[['deliver', 'Deliver from stock'], ['source', 'Source from market']]}
        />

        <form action={formAction} className="flex flex-1 flex-col gap-4">
          {mode === 'deliver' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ff-lot">Lot</Label>
                <select
                  id="ff-lot" name="lotId" required
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">Select…</option>
                  {lots.map((l) => (
                    <option key={l.lotId} value={l.lotId}>
                      {l.lotNo} — {l.balance.toFixed(3)} ct{l.onMemo ? ' (on memo)' : ''}
                      {l.partyName ? ` · ${l.partyName}` : ''}
                    </option>
                  ))}
                </select>
                {stock.others.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-3.5" />
                    show all stock (substitution)
                  </label>
                )}
              </div>

              <Toggle
                value={channel} set={setChannel}
                options={[['memo', 'On memo (approval)'], ['bill', 'On bill (firm sale)']]}
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="ff-supplier">Supplier</Label>
                <select
                  id="ff-supplier" name="supplierId" required
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  onChange={(e) => {
                    const p = suppliers.find((s) => s.id === e.target.value);
                    if (p) setTerms(p.defaultTermsDays);
                  }}
                >
                  <option value="">Select…</option>
                  {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <Toggle
                value={channel} set={setChannel}
                options={[['memo', 'On memo'], ['bill', 'On bill']]}
              />
            </>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ff-carats">Carats</Label>
              <Input
                id="ff-carats" name="carats" type="number" step="0.001" min="0.001" required
                defaultValue={line.outstanding > 0 ? line.outstanding.toFixed(3) : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ff-rate">Rate (₹/ct)</Label>
              <Input
                id="ff-rate" name="rate" type="number" step="0.01" min="0" required
                defaultValue={mode === 'deliver' && line.quotedRate ? line.quotedRate : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ff-on">Date</Label>
              <Input id="ff-on" name="on" type="date" defaultValue={today} required />
            </div>
          </div>

          {channel === 'memo' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ff-memoNo">Memo no.</Label>
                <Input id="ff-memoNo" name="memoNo" required
                       placeholder={mode === 'deliver' ? 'JGD-OUT-…' : 'JGD-IN-…'} />
              </div>
              {mode === 'deliver' ? (
                <div className="space-y-2">
                  <Label htmlFor="ff-due">Due back</Label>
                  <Input id="ff-due" name="dueOn" type="date" defaultValue={due} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="ff-terms">Terms (days)</Label>
                  <Input id="ff-terms" name="termsDays" type="number" min="0" max="365"
                         value={terms} onChange={(e) => setTerms(Number(e.target.value))} />
                </div>
              )}
              {mode === 'deliver' && (
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="ff-agent">Placed by</Label>
                  <Input id="ff-agent" name="agent" list="ff-agents" placeholder="Rushabh" />
                  <datalist id="ff-agents">{agents.map((a) => <option key={a} value={a} />)}</datalist>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="ff-doc">{mode === 'deliver' ? 'Invoice no.' : 'Bill no.'}</Label>
              <Input
                id="ff-doc" name={mode === 'deliver' ? 'invoiceNo' : 'billNo'}
                required={mode === 'deliver'}
                placeholder={mode === 'deliver' ? 'INV-2026-…' : 'Blank = cash'}
              />
            </div>
          )}

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…'
                : mode === 'deliver'
                  ? channel === 'memo' ? 'Issue memo to customer' : 'Bill the customer'
                  : channel === 'memo' ? 'Receive on memo' : 'Buy into stock'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
