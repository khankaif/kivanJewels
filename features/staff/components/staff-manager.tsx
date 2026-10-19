'use client';

import { useActionState, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  addStaffAction, setStaffAccessAction, setStaffPasswordAction, type StaffState,
} from '../actions';
import type { Staff } from '../queries';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

export function AddStaffSheet() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<StaffState, FormData>(
    async (prev, fd) => {
      const res = await addStaffAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );

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
            <NativeSelect
              id="st-role" name="role" defaultValue="user"
              className="w-full"
            >
              <NativeSelectOption value="user">Staff — enters the day&apos;s work</NativeSelectOption>
              <NativeSelectOption value="admin">Admin — also manages staff</NativeSelectOption>
            </NativeSelect>
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
      <div className="min-w-44">
        <div className="font-medium">
          {member.name || '—'}
          {isMe && <span className="ml-2 text-xs text-muted-foreground">you</span>}
        </div>
        <div className="text-xs text-muted-foreground">{member.email}</div>
      </div>

      <Badge variant={member.role === 'admin' ? 'default' : 'outline'}>{member.role}</Badge>
      {member.banned && <Badge variant="destructive">access revoked</Badge>}
      {member.createdAt && (
        <span className="text-xs text-muted-foreground">since {member.createdAt}</span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ResetPasswordSheet member={member} />
        {!isMe && (
          <form action={setStaffAccessAction}>
            <input type="hidden" name="userId" value={member.id} />
            <input type="hidden" name="ban" value={member.banned ? '' : '1'} />
            <Button type="submit" size="sm" variant={member.banned ? 'outline' : 'ghost'}>
              {member.banned ? 'Restore access' : 'Revoke access'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function ResetPasswordSheet({ member }: { member: Staff }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<StaffState, FormData>(
    async (prev, fd) => {
      const res = await setStaffPasswordAction(prev, fd);
      if (res && 'ok' in res) setOpen(false);
      return res;
    },
    null,
  );

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
  const [state, formAction, isPending] = useActionState<StaffState, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd);
      if (res && 'ok' in res) formRef.current?.reset();
      return res;
    },
    null,
  );

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
      {state && 'ok' in state && (
        <p role="status" className="text-sm text-positive sm:col-span-3">{state.ok}</p>
      )}
    </form>
  );
}

