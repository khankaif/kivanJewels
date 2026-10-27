'use client';

import { useState, useTransition } from 'react';
import { Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { parseShorthandAction } from '@/features/masters/diamonds/actions';
import type { Shorthand } from '@/features/masters/diamonds/shorthand';

/**
 * One line the way a trader says it -- "9-9.5 rd e vvs1 2.35 @4200" -- turned
 * into the form's fields. It fills, it never saves: the fields stay editable
 * and the usual checks run on save.
 */
export function QuickEntry({ id, onParsed }: { id: string; onParsed: (r: Shorthand) => void }) {
  const [line, setLine] = useState('');
  const [unknown, setUnknown] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const fill = () => {
    if (!line.trim()) return;
    start(async () => {
      const r = await parseShorthandAction(line);
      setUnknown(r.unknown);
      onParsed(r);
    });
  };

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-quick`}>
        <Wand2 className="size-3.5 text-muted-foreground" /> Quick entry
      </FieldLabel>
      <Input
        id={`${id}-quick`} value={line} onChange={(e) => setLine(e.target.value)} disabled={pending} autoFocus
        placeholder="9-9.5 round E VVS1 2.35 @4200, then Enter"
        // Enter fills the form below; it must not submit it.
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fill(); } }}
      />
      <FieldDescription>
        {unknown?.length
          ? <>Filled what it knew. Not recognised: <span className="font-medium text-foreground">{unknown.join(', ')}</span></>
          : unknown ? 'Filled. Check the fields below before saving.' : 'Size, shape, colour, clarity, carats and @rate, in any order.'}
      </FieldDescription>
    </Field>
  );
}
