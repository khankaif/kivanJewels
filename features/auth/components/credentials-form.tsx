'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import type { AuthState } from '../actions';

/** Sign-in only. Accounts are issued by an admin in Settings → Staff. */
export function CredentialsForm({
  action,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>

      {state?.error && (
        <FieldError>{state.error}</FieldError>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Working…' : 'Sign in'}
      </Button>
    </form>
  );
}
