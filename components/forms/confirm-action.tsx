'use client';

import type { ReactElement } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * A one-click action that cannot be taken back asks once, in plain words, with
 * the safe choice first. Reversible actions don't ask: a confirm on everything
 * trains people to click through the one that matters.
 */
export function ConfirmAction({ action, fields, trigger, title, description, confirm }: {
  action: (fd: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  trigger: ReactElement;
  title: string; description: string; confirm: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action}>
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive">{confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
