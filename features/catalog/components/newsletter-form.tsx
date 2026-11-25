'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { joinNewsletter, type SignupState } from '@/features/catalog/newsletter';

export function NewsletterForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(joinNewsletter, null);
  if (state && 'ok' in state) {
    return (
      <p role="status" aria-live="polite" className="text-sm">
        {state.ok}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <div className="flex max-w-sm border-b border-foreground/35 transition-colors focus-within:border-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-foreground">
        <Input
          type="email" name="email" required autoComplete="email" placeholder="Email address" aria-label="Email address"
          className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          variant="ghost"
          disabled={pending}
          className="h-10 px-0 text-xs uppercase tracking-[0.08em] transition-opacity hover:bg-transparent hover:opacity-70 focus-visible:ring-0"
        >
          {pending ? 'Joining…' : 'Sign up'}
        </Button>
      </div>
      {/* Honeypot: off-screen and out of the tab order, so only bots fill it. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]" />
      {state && 'error' in state && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
