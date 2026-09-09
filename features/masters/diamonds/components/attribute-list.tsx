'use client';

import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  addDiamondAttributeAction, removeDiamondAttributeAction, type MasterState,
} from '../actions';
import type { AttributeType, DiamondAttribute } from '../queries';

const LABELS: Record<AttributeType, string> = {
  shape: 'Shape', colour: 'Colour', clarity: 'Clarity', lab: 'Certification lab',
};

/** One picklist: its current values, a delete button per value, an add form. */
export function AttributeList({ type, values }: { type: AttributeType; values: DiamondAttribute[] }) {
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
      <h3 className="font-medium">{LABELS[type]}</h3>

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

      <form ref={formRef} action={formAction} className="flex gap-2">
        <input type="hidden" name="attributeType" value={type} />
        <Input name="value" placeholder={`Add a ${LABELS[type].toLowerCase()}…`} className="max-w-48" required />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>Add</Button>
      </form>
      {state && 'error' in state && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
