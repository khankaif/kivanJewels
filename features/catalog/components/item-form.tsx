'use client';

import { Choice } from '@/components/forms/choice';
import { useActionState, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { saveItemAction, uploadUrlAction, type CatalogState } from '../actions';
import type { CatalogItem } from '../queries';

const MAX_MB = 10;

export function ItemForm({
  item, categories, stoneTypes, imageBase,
}: {
  item: CatalogItem | null; categories: string[]; stoneTypes: string[];
  /** Null until R2 is configured; uploads are switched off rather than failing. */
  imageBase: string | null;
}) {
  const [state, formAction, isPending] = useActionState<CatalogState, FormData>(saveItemAction, null);
  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const [uploading, setUploading] = useState(0);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      {item && <input type="hidden" name="id" value={item.id} />}
      {images.map((k) => <input key={k} type="hidden" name="images" value={k} />)}

      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="ci-title">Title</FieldLabel>
          <Input
            id="ci-title" name="title" required autoFocus={!item} defaultValue={item?.title}
            placeholder="ÉCLORA — The Circle of Eternal Light"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ci-description">Description</FieldLabel>
          <Textarea id="ci-description" name="description" rows={5} defaultValue={item?.description ?? ''} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ci-category">Category</FieldLabel>
            <Choice
              id="ci-category" name="category" required defaultValue={item?.category ?? ''}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
            <FieldDescription>Add categories in Masters → Diamonds.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="ci-mrp">MRP (₹)</FieldLabel>
            <Input id="ci-mrp" name="mrp" type="number" step="0.01" min="0" defaultValue={item?.mrp ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ci-gross">Gross wt (g)</FieldLabel>
            <Input id="ci-gross" name="grossWtG" type="number" step="0.001" min="0" defaultValue={item?.grossWtG ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ci-stone">Diamond type</FieldLabel>
            <Choice
              id="ci-stone" name="stoneType" defaultValue={item?.stoneType ?? ''}
              options={[{ value: '', label: 'None' }, ...stoneTypes.map((s) => ({ value: s, label: s }))]}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ci-dwt">Diamond wt (ct)</FieldLabel>
            <Input id="ci-dwt" name="diamondWtCt" type="number" step="0.001" min="0" defaultValue={item?.diamondWtCt ?? ''} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ci-quality">Diamond quality</FieldLabel>
            <Input id="ci-quality" name="quality" defaultValue={item?.quality ?? ''} placeholder="VVS-VS-EF" />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <Photos
          images={images} setImages={setImages} imageBase={imageBase} setUploading={setUploading}
        />

        <Label>
          <Checkbox name="published" value="on" defaultChecked={item?.published ?? false} />
          Show on the storefront
        </Label>

        {state && 'error' in state && <FieldError>{state.error}</FieldError>}

        <Button type="submit" className="w-full" disabled={isPending || uploading > 0}>
          {uploading > 0 ? 'Uploading photos…' : isPending ? 'Saving…' : item ? 'Save changes' : 'Add piece'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Uploads go browser -> R2 directly, one presigned PUT per file; the form only
 * ever carries the resulting keys. Order here is the order on the storefront.
 */
function Photos({
  images, setImages, imageBase, setUploading,
}: {
  images: string[]; setImages: React.Dispatch<React.SetStateAction<string[]>>;
  imageBase: string | null;
  setUploading: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [error, setError] = useState('');

  async function add(files: FileList) {
    setError('');
    // ponytail: a photo uploaded and then dropped before saving stays in the
    // bucket. Add an R2 lifecycle rule or a sweep if that ever adds up.
    await Promise.all([...files].map(async (file) => {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`${file.name} is over ${MAX_MB} MB. Export it smaller first.`);
        return;
      }
      setUploading((n) => n + 1);
      try {
        const res = await uploadUrlAction(file.type);
        if ('error' in res) { setError(res.error); return; }
        const put = await fetch(res.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        if (!put.ok) throw new Error(String(put.status));
        setImages((ks) => [...ks, res.key]);
      } catch {
        setError(`${file.name} did not upload. Check your connection and try again.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }));
  }

  const move = (i: number, by: number) => setImages((ks) => {
    const next = [...ks];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    return next;
  });

  return (
    <Field>
      <FieldLabel htmlFor="ci-photos">Photos</FieldLabel>
      {images.length > 0 && imageBase && (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((k, i) => (
            <li key={k} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {/* Admin thumbnails skip optimization: they are few, and every
                  optimized variant counts against the Vercel image quota. */}
              <Image src={`${imageBase}/${k}`} alt="" fill unoptimized className="object-cover" />
              {i === 0 && (
                <Badge variant="secondary" className="absolute left-1 top-1">Cover</Badge>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button type="button" size="icon-xs" variant="secondary" disabled={i === 0}
                        onClick={() => move(i, -1)} aria-label="Move earlier">
                  <ChevronLeft />
                </Button>
                <Button type="button" size="icon-xs" variant="secondary"
                        onClick={() => setImages((ks) => ks.filter((x) => x !== k))} aria-label="Remove photo">
                  <X />
                </Button>
                <Button type="button" size="icon-xs" variant="secondary" disabled={i === images.length - 1}
                        onClick={() => move(i, 1)} aria-label="Move later">
                  <ChevronRight />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Input
        id="ci-photos" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={!imageBase}
        onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }}
      />
      <FieldDescription>
        {imageBase
          ? `First photo is the cover. Up to ${MAX_MB} MB each; around 2000 px wide is plenty.`
          : 'Photo storage is not set up yet (R2 settings missing).'}
      </FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
