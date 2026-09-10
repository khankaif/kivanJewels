'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { savePartyAction, type PartyState } from '../actions';
import type { Party } from '../queries';

export function PartyDialog({ party, defaultOpen = false }: { party?: Party; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction, isPending] = useActionState<PartyState, FormData>(
    async (prev, fd) => {
      const res = await savePartyAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );
  const editing = !!party;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={editing ? 'sm' : 'default'} variant={editing ? 'ghost' : 'default'} />}>
        {editing ? 'Edit' : 'Add party'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${party.name}` : 'Add party'}</DialogTitle>
          <DialogDescription>
            Credit terms drive the due date on inward memos, matching how your sheet sets
            Due Date = purchase date + terms.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={party.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required autoFocus defaultValue={party?.name}
                     placeholder="Naice Gems LLP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName" name="businessName" defaultValue={party?.businessName ?? ''}
                placeholder="If different from name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="kind">Role</Label>
              <select
                id="kind" name="kind" defaultValue={party?.kind ?? 'both'}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="both">Supplier &amp; client</option>
                <option value="supplier">Supplier only</option>
                <option value="client">Client only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTermsDays">Credit terms (days)</Label>
              <Input
                id="defaultTermsDays" name="defaultTermsDays" type="number" min="0" max="365"
                defaultValue={party?.defaultTermsDays ?? 7} required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={party?.phone ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={party?.email ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPerson">Contact person</Label>
            <Input id="contactPerson" name="contactPerson" defaultValue={party?.contactPerson ?? ''} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" name="gstin" defaultValue={party?.gstin ?? ''} className="uppercase" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" name="pan" defaultValue={party?.pan ?? ''} className="uppercase" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={party?.address ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={party?.notes ?? ''} />
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox" name="isActive" defaultChecked={party.isActive}
                className="size-4" value="on"
              />
              Active
            </label>
          )}

          {state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : editing ? 'Save changes' : 'Add party'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
