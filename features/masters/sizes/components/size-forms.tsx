'use client';

import { CsvImport, DownloadLink } from '@/components/forms/csv-import';
import { FormSheet } from '@/components/forms/form-sheet';
import { Choice } from '@/components/forms/choice';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  deleteShapeAction, deleteSizeAction, importSizesAction, saveShapeAction, saveSizeAction,
} from '../actions';
import { trim } from '../chart';
import type { DiamondSize, Shape } from '../queries';

function NumberField({ name, label, defaultValue, placeholder, required }: {
  name: string; label: string; defaultValue?: number | null; placeholder?: string; required?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} name={name} type="number" step="0.01" min="0.01" max="999.99" required={required}
        defaultValue={defaultValue ?? ''} placeholder={placeholder} />
    </Field>
  );
}

/** Add a shape (no `shape`) or edit one. */
export function ShapeSheet({ shape, nextOrder }: { shape?: Shape; nextOrder?: number }) {
  return (
    <FormSheet
      trigger={shape ? <Button variant="ghost" size="sm" /> : <Button variant="outline" size="sm" />}
      label={shape ? 'Edit' : 'Add shape'} title={shape?.shape ?? 'Add shape'} submit="Save"
      description={shape?.sizes
        ? `${shape.sizes} sizes use ${shape.shape}. A new name shows on them and their stock; a new code applies to sizes added from now on.`
        : 'The code prefixes this shape’s Size IDs (PS-4X2.5).'}
      action={saveShapeAction}
      footer={shape && (shape.sizes ? `Can’t remove: ${shape.sizes} sizes use it. Untick Active to retire it.` : (
        <ConfirmAction
          action={deleteShapeAction} fields={{ shape: shape.shape }}
          trigger={<Button variant="ghost" className="text-destructive">Remove shape</Button>}
          title={`Remove ${shape.shape}?`} description="It has no sizes, so nothing else changes." confirm="Remove"
        />
      ))}
    >
      {shape && <input type="hidden" name="original" value={shape.shape} />}
      <Field>
        <FieldLabel htmlFor="shape">Name</FieldLabel>
        <Input id="shape" name="shape" required maxLength={30} defaultValue={shape?.shape} placeholder="Half Moon" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="code">Code</FieldLabel>
          <Input id="code" name="code" required maxLength={4} defaultValue={shape?.code} className="uppercase" />
          <FieldDescription>2–4 letters, e.g. HM.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="sortOrder">Order</FieldLabel>
          <Input id="sortOrder" name="sortOrder" type="number" step="1" defaultValue={shape?.sort_order ?? nextOrder ?? 0} />
        </Field>
      </div>
      <Label className="font-normal">
        <Checkbox name="hasCut" value="on" defaultChecked={shape?.has_cut ?? false} />
        Graded on cut (round). Fancy shapes: polish and symmetry only.
      </Label>
      <Label className="font-normal">
        <Checkbox name="active" value="on" defaultChecked={shape?.active ?? true} />
        Active: offered in pickers
      </Label>
    </FormSheet>
  );
}

/** Add one size (no `size`) or edit one. */
export function SizeSheet({ size, shapes }: { size?: DiamondSize; shapes: Shape[] }) {
  const carats = size ? trim(size.min_ct) : '';
  return (
    <FormSheet
      trigger={size ? <Button variant="ghost" size="sm" /> : <Button />}
      label={size ? 'Edit' : 'New size'} title={size ? `Edit ${size.id}` : 'New size'} submit="Save"
      description={size?.used
        ? `${size.used} lots, sale lines or prices are on ${size.id}. Changing its mm or carats changes what all of them say they are.`
        : 'Face-up mm and the carats one stone of that size weighs. The Size ID is made from the shape code and mm.'}
      action={saveSizeAction}
      footer={size && (size.used ? 'In use, so it can’t be deleted. Untick Active to retire it from pickers.' : (
        <ConfirmAction
          action={deleteSizeAction} fields={{ id: size.id }}
          trigger={<Button variant="ghost" className="text-destructive">Delete size</Button>}
          title={`Delete ${size.id}?`} description="Nothing uses it. This cannot be undone." confirm="Delete"
        />
      ))}
    >
      {size && <input type="hidden" name="originalId" value={size.id} />}
      <Field>
        <FieldLabel htmlFor="shape">Shape</FieldLabel>
        {/* A disabled select is not submitted, so an edit sends the shape hidden. */}
        {size && <input type="hidden" name="shape" value={size.shape} />}
        <Choice id="shape" name={size ? undefined : 'shape'} required disabled={!!size} defaultValue={size?.shape}
          options={shapes.filter((s) => s.active || s.shape === size?.shape).map((s) => ({ value: s.shape, label: s.shape }))} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="length_mm" label="Length mm" required defaultValue={size?.length_mm} />
        <NumberField name="width_mm" label="Width mm" required defaultValue={size?.width_mm} />
        <NumberField name="width2_mm" label="Narrow mm" defaultValue={size?.width2_mm} placeholder="Tapered only" />
      </div>
      <Field>
        <FieldLabel htmlFor="carats">Carats per stone</FieldLabel>
        <Input
          id="carats"
          name="carats"
          type="number"
          step="any"
          min="0.0001"
          max="100"
          required
          defaultValue={carats}
          placeholder="0.014 or 0.0145"
        />
        <FieldDescription>Single weight per stone (e.g. 0.014 or 0.0145 ct).</FieldDescription>
      </Field>
      <Label className="font-normal">
        <Checkbox name="retired" value="on" defaultChecked={size ? !size.active : false} />
        Retired: kept on its stock, left out of pickers
      </Label>
    </FormSheet>
  );
}

/** The size chart as CSV: export, edit in Excel, import back. */
export function ImportSizes() {
  return (
    <CsvImport
      action={importSizesAction} title="Import size chart"
      description="Edit the Export (or the client chart) in Excel and upload it. A row with a size_id edits that size; a blank size_id adds one. Sizes left out of the file are kept."
      links={<>
        <DownloadLink href="/api/export?view=size_chart">Export current chart</DownloadLink>
        <DownloadLink href="/samples/size-chart.csv">Client chart (sample)</DownloadLink>
      </>}
      columns={<>Columns: size_id, shape (name or code), length_mm, width_mm, width2_mm (tapered baguette
        narrow end), carats (0.1 or 0.014-0.015), active (yes/no).</>}
    />
  );
}
