'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { useFormAction } from '@/lib/use-form-action';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

export type FormState = { error: string } | { ok: string } | null;

/** A side sheet holding one form: inline error, closes on success (toast via useFormAction). */
export function FormSheet({ trigger, label, title, description, action, submit, children, footer }: {
  trigger: ReactElement; label: string; title: string; description: string;
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  submit: string; children: ReactNode; footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useFormAction(action, () => setOpen(false));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger}>{label}</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {children}
          {state && 'error' in state && <FieldError>{state.error}</FieldError>}
          <SheetFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : submit}</Button>
          </SheetFooter>
        </form>
        {/* Outside the form: a confirm's own form must not submit this one. */}
        {footer && <div className="px-4 text-sm text-muted-foreground">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
