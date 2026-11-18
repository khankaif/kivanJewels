'use client';

import { FormSheet } from '@/components/forms/form-sheet';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { deleteGradeAction, saveGradeAction } from '../actions';
import type { GradeRow, ListName } from '../queries';

/** Add a value to a list (no `row`) or edit one. */
export function GradeSheet({ list, label, row, nextOrder }: {
  list: ListName; label: string; row?: GradeRow; nextOrder?: number;
}) {
  const inUse = row?.used ?? 0;
  return (
    <FormSheet
      trigger={row ? <Button variant="ghost" size="sm" /> : <Button variant="outline" size="sm" />}
      label={row ? 'Edit' : 'Add'} title={row ? `Edit ${row.name}` : `Add to ${label}`} submit="Save"
      description={inUse
        ? `${inUse} records use ${row!.name}. A new name shows on all of them, old bills included.`
        : 'Pickers list values by order, then name.'}
      action={saveGradeAction}
      footer={row && (inUse ? 'In use, so it can’t be deleted. Untick Active to retire it from pickers.' : (
        <ConfirmAction
          action={deleteGradeAction} fields={{ list, name: row.name }}
          trigger={<Button variant="ghost" className="text-destructive">Delete</Button>}
          title={`Delete ${row.name}?`} description="Nothing uses it, so nothing else changes." confirm="Delete"
        />
      ))}
    >
      <input type="hidden" name="list" value={list} />
      {row && <input type="hidden" name="original" value={row.name} />}
      <Field>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <Input id="name" name="name" required maxLength={40} defaultValue={row?.name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="code">Code</FieldLabel>
          <Input id="code" name="code" maxLength={10} defaultValue={row?.code ?? ''} className="uppercase" />
          <FieldDescription>Short form traders type, e.g. FLY.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="sortOrder">Order</FieldLabel>
          <Input id="sortOrder" name="sortOrder" type="number" step="1"
                 defaultValue={row?.sort_order ?? nextOrder ?? 0} />
        </Field>
      </div>
      <Label className="font-normal">
        <Checkbox name="active" value="on" defaultChecked={row?.active ?? true} />
        Active: offered in pickers
      </Label>
    </FormSheet>
  );
}
