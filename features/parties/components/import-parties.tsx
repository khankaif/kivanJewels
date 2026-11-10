'use client';

import { useState } from 'react';
import { useFormAction } from '@/lib/use-form-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { importPartiesAction } from '../actions';

export function ImportParties() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useFormAction(importPartiesAction, () => setOpen(false));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" />}>Import</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Import parties</SheetTitle>
          <SheetDescription>
            Upload a CSV in the sample&apos;s format. A name that already exists is updated; any
            bad row stops the whole file, so nothing is half-imported.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-4">
          <Button variant="link" className="h-auto px-0" nativeButton={false} render={<a href="/samples/parties.csv" download />}>
            Download sample CSV
          </Button>
          <Field>
            <FieldLabel htmlFor="file">CSV file</FieldLabel>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
            <FieldDescription>
              Only <code>name</code> is required. Role is supplier, client or both (blank = both);
              terms are days (blank = 7). In Excel, format phone and GSTIN as Text first, or
              Excel rewrites long numbers like 9820012345 as 9.82E+09.
            </FieldDescription>
          </Field>
          {state && 'error' in state && <FieldError className="whitespace-pre-line">{state.error}</FieldError>}
          <SheetFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Importing…' : 'Import'}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
