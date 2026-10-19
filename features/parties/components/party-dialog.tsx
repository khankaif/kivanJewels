'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { savePartyAction, type PartyState } from '../actions';
import type { Party } from '../queries';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size={editing ? 'sm' : 'default'} variant={editing ? 'ghost' : 'default'} />}>
        {editing ? 'Edit' : 'Add party'}
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${party.name}` : 'Add party'}</SheetTitle>
          <SheetDescription>
            Credit terms drive the due date on inward memos, matching how your sheet sets
            Due Date = purchase date + terms.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={party.id} />}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" required autoFocus defaultValue={party?.name}
                     placeholder="Naice Gems LLP" />
            </Field>
            <Field>
              <FieldLabel htmlFor="businessName">Business name</FieldLabel>
              <Input
                id="businessName" name="businessName" defaultValue={party?.businessName ?? ''}
                placeholder="If different from name"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="kind">Role</FieldLabel>
              <NativeSelect
                id="kind" name="kind" defaultValue={party?.kind ?? 'both'}
                className="w-full"
              >
                <NativeSelectOption value="both">Supplier &amp; client</NativeSelectOption>
                <NativeSelectOption value="supplier">Supplier only</NativeSelectOption>
                <NativeSelectOption value="client">Client only</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="defaultTermsDays">Credit terms (days)</FieldLabel>
              <Input
                id="defaultTermsDays" name="defaultTermsDays" type="number" min="0" max="365"
                defaultValue={party?.defaultTermsDays ?? 7} required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input id="phone" name="phone" defaultValue={party?.phone ?? ''} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" defaultValue={party?.email ?? ''} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="contactPerson">Contact person</FieldLabel>
            <Input id="contactPerson" name="contactPerson" defaultValue={party?.contactPerson ?? ''} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
              <Input id="gstin" name="gstin" defaultValue={party?.gstin ?? ''} className="uppercase" />
            </Field>
            <Field>
              <FieldLabel htmlFor="pan">PAN</FieldLabel>
              <Input id="pan" name="pan" defaultValue={party?.pan ?? ''} className="uppercase" />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="address">Address</FieldLabel>
            <Input id="address" name="address" defaultValue={party?.address ?? ''} />
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Input id="notes" name="notes" defaultValue={party?.notes ?? ''} />
          </Field>

          {editing && (
            <Label>
              <Checkbox name="isActive" value="on" defaultChecked={party.isActive} />
              Active
            </Label>
          )}

          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : editing ? 'Save changes' : 'Add party'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
