'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { receiveMemoAction, type ActionState } from '../actions';

type Party = { id: string; name: string; defaultTermsDays: number };

export function ReceiveMemoDialog({
  suppliers, agents, shapes, colours, clarities,
}: { suppliers: Party[]; agents: string[]; shapes: string[]; colours: string[]; clarities: string[] }) {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState(7);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await receiveMemoAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Receive from supplier</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive inward memo (jangad in)</DialogTitle>
          <DialogDescription>
            Goods arrive on approval. Carats enter the vault immediately and can be issued onward,
            but <strong>no payable is created</strong> until the supplier bills you.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="in-memoNo">Memo no.</Label>
              <Input id="in-memoNo" name="memoNo" required placeholder="JGD-IN-2026-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-partyId">Supplier</Label>
              <select
                id="in-partyId" name="partyId" required
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
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="in-stoneType">Type</Label>
              <Input id="in-stoneType" name="stoneType" defaultValue="Lab Grown" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-shape">Shape</Label>
              <Input id="in-shape" name="shape" list="in-shape-list" placeholder="Round" />
              <datalist id="in-shape-list">
                {shapes.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-sieve">Sieve</Label>
              <Input id="in-sieve" name="sieveSize" placeholder="6.5-7" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-mm">MM</Label>
              <Input id="in-mm" name="mmSize" placeholder="1.80" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="in-colour">Colour</Label>
              <Input id="in-colour" name="colour" list="in-colour-list" placeholder="EF" />
              <datalist id="in-colour-list">
                {colours.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-clarity">Clarity</Label>
              <Input id="in-clarity" name="clarity" list="in-clarity-list" placeholder="VVS-VS" />
              <datalist id="in-clarity-list">
                {clarities.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="in-carats">Carats</Label>
              <Input id="in-carats" name="carats" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-rate">Rate (₹/ct)</Label>
              <Input id="in-rate" name="rate" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-terms">Terms (days)</Label>
              <Input
                id="in-terms" name="termsDays" type="number" min="0" max="365"
                value={terms} onChange={(e) => setTerms(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="in-issuedOn">Received on</Label>
              <Input id="in-issuedOn" name="issuedOn" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-agent">Placed by</Label>
              <Input id="in-agent" name="agent" list="agent-list" placeholder="Rushabh" />
              <datalist id="agent-list">
                {agents.map((a) => <option key={a} value={a} />)}
              </datalist>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Due date is set automatically to received date + terms, matching how your sheet
            computes it.
          </p>

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Receiving…' : 'Receive goods'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
