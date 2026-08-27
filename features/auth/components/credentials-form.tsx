'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuthState } from '../actions';

type Props = {
  mode: 'sign-in' | 'sign-up';
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

export function CredentialsForm({ mode, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const isSignUp = mode === 'sign-up';

  return (
    <form action={formAction} className="space-y-4">
      {isSignUp && (
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" placeholder="Rushabh" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
