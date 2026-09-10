'use client';

import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  addDiamondAttributeAction, removeBucketAction, removeDiamondAttributeAction,
  setUsesSieveAction, type MasterState,
} from '../actions';
import type { Bucket, DiamondAttribute } from '../queries';

/** One picklist: its current values, a delete button per value, an add form. */
export function AttributeList({ bucket, values }: { bucket: Bucket; values: DiamondAttribute[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<MasterState, FormData>(
    async (prev, fd) => {
      const res = await addDiamondAttributeAction(prev, fd);
      if (res && 'ok' in res) formRef.current?.reset();
      return res;
    },
    null,
  );

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">
          {bucket.label}
          {bucket.key === 'shape' && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              sieved or measured in mm
            </span>
          )}
        </h3>
        {!bucket.isPreset && (
          <form action={removeBucketAction}>
            <input type="hidden" name="key" value={bucket.key} />
            <button type="submit" className="text-xs text-muted-foreground hover:text-destructive">
              delete list
            </button>
          </form>
        )}
      </div>

      {/* Shapes carry the one rule the forms need: sieved, or measured in mm. */}
      {bucket.key === 'shape' ? (
        <div className="space-y-1">
          {values.map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-sm">
              <form action={setUsesSieveAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="usesSieve" value={v.usesSieve ? '' : '1'} />
                <button
                  type="submit"
                  className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                  title={v.usesSieve ? 'Sieved — click to measure in mm' : 'Measured in mm — click to sieve'}
                >
                  {v.usesSieve ? 'sieve' : 'mm'}
                </button>
              </form>
              <span className="flex-1">{v.value}</span>
              <form action={removeDiamondAttributeAction}>
                <input type="hidden" name="id" value={v.id} />
                <button
                  type="submit" aria-label={`Remove ${v.value}`}
                  className="px-1 text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
          {!values.length && <span className="text-sm text-muted-foreground">Nothing yet.</span>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <form key={v.id} action={removeDiamondAttributeAction}>
              <input type="hidden" name="id" value={v.id} />
              <Badge variant="outline" className="gap-1.5 pr-1">
                {v.value}
                <button
                  type="submit" aria-label={`Remove ${v.value}`}
                  className="rounded-full px-1 text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            </form>
          ))}
          {!values.length && <span className="text-sm text-muted-foreground">Nothing yet.</span>}
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex gap-2">
        <input type="hidden" name="attributeType" value={bucket.key} />
        <Input name="value" placeholder={`Add a ${bucket.label.toLowerCase()}…`} className="max-w-48" required />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>Add</Button>
      </form>
      {state && 'error' in state && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}

/** Adds a whole new picklist. Values go in once the list exists. */
export function AddBucket({ action }: { action: (p: MasterState, fd: FormData) => Promise<MasterState> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<MasterState, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd);
      if (res && 'ok' in res) formRef.current?.reset();
      return res;
    },
    null,
  );
  return (
    <div className="space-y-2">
      <form ref={formRef} action={formAction} className="flex gap-2">
        <Input name="label" placeholder="New list — Cut, Growth type, Treatment…" className="max-w-72" required />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>Add list</Button>
      </form>
      {state && 'error' in state && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
