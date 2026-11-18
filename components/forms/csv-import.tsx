'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

export type ImportState =
  | { error: string }
  | { ok: string }
  | { preview: { summary: string; changes: string[]; canApply: boolean } }
  | null;

/**
 * Upload a CSV in two clicks: Check runs the action with mode=check (it
 * reports what would change and saves nothing), Import re-sends the same file
 * with mode=apply. Stateless on the server: nothing is staged in between.
 */
export function CsvImport({ action, title, description, links, columns }: {
  action: (prev: ImportState, fd: FormData) => Promise<ImportState>;
  title: string; description: string; links: ReactNode; columns: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // A preview describes the file it checked; choosing another file voids it.
  const [stale, setStale] = useState(false);
  const [state, formAction, isPending] = useActionState<ImportState, FormData>(async (prev, fd) => {
    const res = await action(prev, fd);
    setStale(false);
    if (res && 'ok' in res) { toast.success(res.ok); setOpen(false); }
    return res;
  }, null);
  const shown = stale ? null : state;
  const preview = shown && 'preview' in shown ? shown.preview : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" />}>Import CSV</SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          <div className="flex flex-wrap gap-x-4">{links}</div>
          <Field>
            <FieldLabel htmlFor="file">CSV file</FieldLabel>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required onChange={() => setStale(true)} />
            <FieldDescription>{columns}</FieldDescription>
          </Field>
          {shown && 'error' in shown && <FieldError className="whitespace-pre-line">{shown.error}</FieldError>}
          {preview && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p className="font-medium">{preview.summary}</p>
              {!!preview.changes.length && (
                <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-muted-foreground">
                  {preview.changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              )}
            </div>
          )}
          <SheetFooter>
            {preview?.canApply ? (
              <Button type="submit" name="mode" value="apply" disabled={isPending}>{isPending ? 'Importing…' : 'Import'}</Button>
            ) : (
              <Button type="submit" name="mode" value="check" disabled={isPending || !!preview}>
                {isPending ? 'Checking…' : preview ? 'Nothing to change' : 'Check file'}
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** A download link styled for the import sheet. */
export function DownloadLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="link" className="h-auto px-0" nativeButton={false} render={<a href={href} download />}>
      {children}
    </Button>
  );
}
