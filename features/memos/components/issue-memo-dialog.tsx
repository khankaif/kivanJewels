'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { issueMemoAction, type ActionState } from '../actions';

type Lot = { lotId: string; lotNo: string; stoneType: string; sieveSize: string | null; balance: number; costRate: number };
type Party = { id: string; name: string; defaultTermsDays: number };

export function IssueMemoDialog({
  lots, parties, agents,
}: { lots: Lot[]; parties: Party[]; agents: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await issueMemoAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(new Date(today).getTime() + 7 * 864e5).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Issue memo</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue outward memo (jangad)</DialogTitle>
          <DialogDescription>
            Carats leave the vault immediately. The lot balance is checked in the database, so
            issuing more than a lot holds is refused.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="memoNo">Memo no.</Label>
              <Input id="memoNo" name="memoNo" required placeholder="JGD-OUT-2026-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partyId">Client</Label>
              <select
                id="partyId" name="partyId" required
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Select…</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lotId">Lot</Label>
            <select
              id="lotId" name="lotId" required
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Select…</option>
              {lots.map((l) => (
                <option key={l.lotId} value={l.lotId}>
                  {l.lotNo} — {l.stoneType} {l.sieveSize ?? ''} ({l.balance.toFixed(3)} ct available)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="carats">Carats</Label>
              <Input id="carats" name="carats" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Rate (₹/ct)</Label>
              <Input id="rate" name="rate" type="number" step="0.01" min="0" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="issuedOn">Issued</Label>
              <Input id="issuedOn" name="issuedOn" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueOn">Due back</Label>
              <Input id="dueOn" name="dueOn" type="date" defaultValue={due} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="out-agent">Placed by</Label>
            <Input id="out-agent" name="agent" list="agent-list-out" placeholder="Rushabh" />
            <datalist id="agent-list-out">
              {agents.map((a) => <option key={a} value={a} />)}
            </datalist>
          </div>

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Issuing…' : 'Issue memo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
