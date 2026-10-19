'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { adoptValueAction, aliasValueAction, type MasterState } from '../actions';
import type { Mismatch } from '../queries';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

/**
 * What the book says that the master does not recognise. Every one of these
 * would be refused on the next save, so each gets two ways out: adopt it as a
 * real master value, or map it onto one that already exists.
 */
export function MismatchList({
  mismatches, valuesByBucket,
}: {
  mismatches: Mismatch[]; valuesByBucket: Record<string, string[]>;
}) {
  if (!mismatches.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Every value in the book resolves to a master value. Nothing to fix.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {mismatches.map((m) => (
        <MismatchRow
          key={`${m.bucket}:${m.value}`} mismatch={m}
          options={valuesByBucket[m.bucket] ?? []}
        />
      ))}
    </div>
  );
}

function MismatchRow({ mismatch, options }: { mismatch: Mismatch; options: string[] }) {
  const [state, formAction, isPending] = useActionState<MasterState, FormData>(aliasValueAction, null);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <div className="min-w-40">
        <span className="font-medium">{mismatch.value}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {mismatch.label} · {mismatch.lots} row{mismatch.lots === 1 ? '' : 's'}
        </span>
      </div>

      <form action={adoptValueAction} className="ml-auto">
        <input type="hidden" name="bucket" value={mismatch.bucket} />
        <input type="hidden" name="value" value={mismatch.value} />
        <Button type="submit" size="sm" variant="outline">Add to master</Button>
      </form>

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="bucket" value={mismatch.bucket} />
        <input type="hidden" name="value" value={mismatch.value} />
        <NativeSelect
          name="target" required defaultValue=""
        >
          <NativeSelectOption value="">same as…</NativeSelectOption>
          {options.map((v) => <NativeSelectOption key={v} value={v}>{v}</NativeSelectOption>)}
        </NativeSelect>
        <Button type="submit" size="sm" variant="ghost" disabled={isPending}>Map</Button>
      </form>

      {state && 'error' in state && (
        <FieldError className="basis-full text-xs">{state.error}</FieldError>
      )}
    </div>
  );
}
