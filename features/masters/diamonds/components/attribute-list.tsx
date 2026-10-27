'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useRef } from 'react';
import { useFormAction } from '@/lib/use-form-action';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { ButtonGroup } from '@/components/ui/button-group';
import { FieldError } from '@/components/ui/field';
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
  const [state, formAction, isPending] = useFormAction(addDiamondAttributeAction, () => formRef.current?.reset());

  return (
    <Card size="sm"><CardContent className="space-y-3">
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
          <ConfirmAction
            action={removeBucketAction} fields={{ key: bucket.key }}
            trigger={<Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">Delete list</Button>}
            title={`Delete the ${bucket.label} list?`}
            description={`Its ${values.length} value${values.length === 1 ? '' : 's'} stop being offered on new entries. Existing stock keeps what it already has.`}
            confirm="Delete list"
          />
        )}
      </div>

      {/* Shapes carry the one rule the forms need: sieved, or measured in mm. */}
      {bucket.key === 'shape' ? (
        <div className="space-y-1">
          {values.map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-sm">
              {/* Both states are shown with the current one filled in. A single
                  button labelled with the current state reads as a choice you
                  have made, not one you are about to flip. */}
              <form action={setUsesSieveAction}>
                <input type="hidden" name="id" value={v.id} />
                <ButtonGroup>
                  {([['1', 'sieve', 'measured on a sieve'], ['', 'mm', 'measured in mm']] as const).map(([val, label, how]) => (
                    <Button
                      key={label} type="submit" name="usesSieve" value={val} size="xs"
                      variant={v.usesSieve === !!val ? 'default' : 'outline'} aria-pressed={v.usesSieve === !!val}
                      title={`${v.value} is ${how}`}
                    >
                      {label}
                    </Button>
                  ))}
                </ButtonGroup>
              </form>
              <span className="flex-1">{v.value}</span>
              <form action={removeDiamondAttributeAction}>
                <input type="hidden" name="id" value={v.id} />
                <Button
                  type="submit" variant="ghost" size="icon-xs" aria-label={`Remove ${v.value}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </Button>
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
                <Button
                  type="submit" variant="ghost" size="icon-xs" aria-label={`Remove ${v.value}`}
                  className="rounded-full text-muted-foreground hover:text-destructive"
                >
                  ×
                </Button>
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
      {state && 'error' in state && <FieldError>{state.error}</FieldError>}
    </CardContent></Card>
  );
}

/** Adds a whole new picklist. Values go in once the list exists. */
export function AddBucket({ action }: { action: (p: MasterState, fd: FormData) => Promise<MasterState> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useFormAction(action, () => formRef.current?.reset());
  return (
    <div className="space-y-2">
      <form ref={formRef} action={formAction} className="flex gap-2">
        <Input name="label" placeholder="New list — Cut, Growth type, Treatment…" className="max-w-72" required />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>Add list</Button>
      </form>
      {state && 'error' in state && <FieldError>{state.error}</FieldError>}
    </div>
  );
}
