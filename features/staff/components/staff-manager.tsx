'use client';

import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Choice } from '@/components/forms/choice';
import { useRef, useState } from 'react';
import { day } from '@/lib/format';
import { useFormAction } from '@/lib/use-form-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  addStaffAction, setStaffAccessAction, setStaffPasswordAction, type StaffState,
} from '../actions';
import type { Staff } from '../queries';

export function AddStaffSheet() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useFormAction(addStaffAction, () => setOpen(false));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add staff</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Add a staff member</SheetTitle>
          <SheetDescription>
            You set their first password here and pass it to them yourself — there is no sign-up
            page and no reset email, so nothing about this account travels by post.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="st-name">Name</FieldLabel>
            <Input id="st-name" name="name" required autoFocus placeholder="Rushabh" />
          </Field>
          <Field>
            <FieldLabel htmlFor="st-email">Email</FieldLabel>
            <Input id="st-email" name="email" type="email" required placeholder="name@kaivanjewels.in" />
          </Field>
          <Field>
            <FieldLabel htmlFor="st-password">First password</FieldLabel>
            <Input
              id="st-password" name="password" type="password" required minLength={12}
              autoComplete="new-password" placeholder="At least 12 characters"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="st-role">Role</FieldLabel>
            <Choice
              id="st-role" name="role" defaultValue="user"
              options={[
                { value: 'user', label: 'Staff — enters the day’s work' },
                { value: 'admin', label: 'Admin — also manages staff' },
              ]}
            />
          </Field>

          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create account'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function StaffRow({ member, isMe }: { member: Staff; isMe: boolean }) {
  return (
    <Item variant="outline">
      <ItemContent className="min-w-44">
        <ItemTitle>
          {member.name || '—'}
          {isMe && <span className="font-normal text-muted-foreground">you</span>}
          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>{member.role === 'admin' ? 'Admin' : 'Staff'}</Badge>
          {member.banned && <Badge variant="destructive">Access revoked</Badge>}
        </ItemTitle>
        <ItemDescription>
          {member.email}{member.createdAt && ` · since ${day(member.createdAt)}`}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <ResetPasswordSheet member={member} />
        {!isMe && (
          member.banned ? (
            <form action={setStaffAccessAction}>
              <input type="hidden" name="userId" value={member.id} />
              <input type="hidden" name="ban" value="" />
              <Button type="submit" size="sm" variant="outline">Restore access</Button>
            </form>
          ) : (
            <ConfirmAction
              action={setStaffAccessAction} fields={{ userId: member.id, ban: '1' }}
              trigger={<Button size="sm" variant="ghost">Revoke access</Button>}
              title={`Revoke access for ${member.name || member.email}?`}
              description="They are signed out and can't sign in again until you restore access. Nothing they entered is removed."
              confirm="Revoke access"
            />
          )
        )}
      </ItemActions>
    </Item>
  );
}

function ResetPasswordSheet({ member }: { member: Staff }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useFormAction(setStaffPasswordAction, () => setOpen(false));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="outline" />}>Reset password</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Reset password — {member.name || member.email}</SheetTitle>
          <SheetDescription>
            Sets a new password immediately. Their old one stops working, so tell them before you do
            it.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <input type="hidden" name="userId" value={member.id} />
          <Field>
            <FieldLabel htmlFor={`rp-${member.id}`}>New password</FieldLabel>
            <Input
              id={`rp-${member.id}`} name="newPassword" type="password" required minLength={12}
              autoComplete="new-password" placeholder="At least 12 characters"
            />
          </Field>
          {state && 'error' in state && (
            <FieldError>{state.error}</FieldError>
          )}
          <SheetFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Setting…' : 'Set password'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ChangeMyPassword({
  action,
}: {
  action: (prev: StaffState, fd: FormData) => Promise<StaffState>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useFormAction(action, () => formRef.current?.reset());

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field>
        <FieldLabel htmlFor="cp-current">Current password</FieldLabel>
        <Input id="cp-current" name="currentPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field>
        <FieldLabel htmlFor="cp-new">New password</FieldLabel>
        <Input
          id="cp-new" name="newPassword" type="password" required minLength={12}
          autoComplete="new-password" placeholder="At least 12 characters"
        />
      </Field>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Changing…' : 'Change password'}
      </Button>

      {state && 'error' in state && (
        <FieldError className="sm:col-span-3">{state.error}</FieldError>
      )}
    </form>
  );
}

