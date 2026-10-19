'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Segmented } from '@/components/ui/segmented';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { specLabel } from '@/lib/format';
import { CaratsRate } from '@/components/ui/carats-rate';
import { deliverAction, sourceAction, type ActionState } from '../actions';
import type { RequirementLine, SpecLot } from '../queries';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

type Party = { id: string; name: string; defaultTermsDays: number };

export function FulfilSheet({
  line, stock, suppliers, agents, defaultOpen = false,
}: {
  line: RequirementLine;
  stock: { exact: SpecLot[]; others: SpecLot[] };
  suppliers: Party[]; agents: string[];
  /** The pipeline board links straight into a line's drawer. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
  const label = specLabel(line);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Fulfil</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Fulfil order line</SheetTitle>
          <SheetDescription>
            {label} · {line.outstanding.toFixed(3)} ct still to fulfil.
            {line.inStock > 0.0005 && ` ${line.inStock.toFixed(3)} ct is available now.`}
          </SheetDescription>
        </SheetHeader>

        <Segmented
          value={mode} set={setMode}
          options={[['deliver', 'Use available stock'], ['source', 'Source from supplier']]}
        />

        <form action={formAction} className="flex flex-1 flex-col gap-4">
          {mode === 'deliver' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ff-lot">Lot</Label>
                <NativeSelect
                  id="ff-lot" name="lotId" required
                  className="w-full"
                >
                  <NativeSelectOption value="">Select…</NativeSelectOption>
                  {lots.map((l) => (
                    <NativeSelectOption key={l.lotId} value={l.lotId}>
                      {l.lotNo} — {l.balance.toFixed(3)} ct{l.onMemo ? ' (on memo)' : ''}
                      {l.partyName ? ` · ${l.partyName}` : ''}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {stock.others.length > 0 && (
                  <Label className="text-xs text-muted-foreground">
                    <Checkbox checked={showAll} onCheckedChange={setShowAll} />
                    Allow a substitution from another specification
                  </Label>
                )}
              </div>

              <Segmented
                value={channel} set={setChannel}
                options={[['memo', 'Send on approval'], ['bill', 'Firm sale / invoice']]}
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="ff-supplier">Supplier</Label>
                <NativeSelect
                  id="ff-supplier" name="supplierId" required
                  className="w-full"
                  onChange={(e) => {
                    const p = suppliers.find((s) => s.id === e.target.value);
                    if (p) setTerms(p.defaultTermsDays);
                  }}
                >
                  <NativeSelectOption value="">Select…</NativeSelectOption>
                  {suppliers.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}
                </NativeSelect>
              </div>

              <Segmented
                value={channel} set={setChannel}
                options={[['memo', 'Supplier approval'], ['bill', 'Purchase bill']]}
              />
            </>
          )}

          <CaratsRate
            id="ff"
            defaultCarats={line.outstanding > 0 ? line.outstanding.toFixed(3) : ''}
            defaultRate={mode === 'deliver' && line.quotedRate ? line.quotedRate : ''}
            rateLabel={mode === 'deliver' ? 'Rate (₹/ct)' : 'Cost (₹/ct)'}
          />

          <div className="space-y-2">
            <Label htmlFor="ff-on">Date</Label>
            <Input id="ff-on" name="on" type="date" defaultValue={today} required />
          </div>

          {channel === 'memo' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ff-memoNo">Memo no.</Label>
                <Input id="ff-memoNo" name="memoNo" placeholder="Blank = we number it" />
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
                placeholder={mode === 'deliver' ? 'Blank = we number it' : 'Blank = cash'}
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
                  ? channel === 'memo' ? 'Send on approval' : 'Create customer invoice'
                  : channel === 'memo' ? 'Receive on supplier approval' : 'Buy into stock'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
