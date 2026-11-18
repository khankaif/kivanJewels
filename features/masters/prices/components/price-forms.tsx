'use client';

import { FormSheet } from '@/components/forms/form-sheet';
import { CsvImport, DownloadLink } from '@/components/forms/csv-import';
import { Choice } from '@/components/forms/choice';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FieldLabel } from '@/components/ui/field';
import { deleteQualityAction, importPricesAction, saveQualityAction } from '../actions';
import { qualityLabel } from '../grid';
import type { QualityRow } from '../queries';

/** Add a quality option (pick a colour and a clarity from the master) or edit one's order and status. */
export function QualitySheet({ row, colours, clarities, nextOrder }: {
  row?: QualityRow; colours: string[]; clarities: string[]; nextOrder?: number;
}) {
  const label = row && qualityLabel(row);
  return (
    <FormSheet
      trigger={row ? <Button variant="ghost" size="sm" /> : <Button variant="outline" size="sm" />}
      label={row ? 'Edit' : 'Add quality'} title={row ? `Edit ${label}` : 'Add quality option'} submit="Save"
      description="A colour and a clarity from the grade master that the catalog offers shoppers. Each becomes a column of the price grid."
      action={saveQualityAction}
      footer={row && (row.prices ? `Has ${row.prices} prices, so it can’t be deleted. Untick Active to retire it.` : (
        <ConfirmAction
          action={deleteQualityAction} fields={{ colour: row.colour, clarity: row.clarity }}
          trigger={<Button variant="ghost" className="text-destructive">Delete</Button>}
          title={`Delete ${label}?`} description="It has no prices, so nothing else changes." confirm="Delete"
        />
      ))}
    >
      {row ? (
        <>
          <input type="hidden" name="editing" value="on" />
          <input type="hidden" name="colour" value={row.colour} />
          <input type="hidden" name="clarity" value={row.clarity} />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="colour">Colour</FieldLabel>
            <Choice id="colour" name="colour" required searchable options={colours.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field>
            <FieldLabel htmlFor="clarity">Clarity</FieldLabel>
            <Choice id="clarity" name="clarity" required searchable options={clarities.map((c) => ({ value: c, label: c }))} />
          </Field>
        </div>
      )}
      <Field>
        <FieldLabel htmlFor="sortOrder">Order</FieldLabel>
        <Input id="sortOrder" name="sortOrder" type="number" step="1" defaultValue={row?.sort_order ?? nextOrder ?? 0} />
      </Field>
      <Label className="font-normal">
        <Checkbox name="active" value="on" defaultChecked={row?.active ?? true} />
        Active: a column of the grid, offered in the catalog
      </Label>
    </FormSheet>
  );
}

/** The price grid as CSV: export a stone type, fill it in Excel, import it back. */
export function ImportPrices({ stoneType }: { stoneType: string }) {
  return (
    <CsvImport
      action={importPricesAction} title="Import prices"
      description="Rupees per carat. Every cell in the file is the price for its row and column: a number sets it, a blank removes it. Rows, stone types and quality columns the file leaves out are kept."
      links={<DownloadLink href={`/api/masters/prices?type=${encodeURIComponent(stoneType)}`}>Export {stoneType} grid</DownloadLink>}
      columns={<>Columns: stone_type and size_id say which row it is; shape, mm and carats are for reading
        and ignored; every other column is a quality (EF VVS-VS). Prices may use commas or ₹.</>}
    />
  );
}
