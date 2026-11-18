'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { setPriceAction } from '../actions';

/** One editable price. Saves when you leave the cell (or press Enter); Escape puts it back. */
export function PriceCell({ stoneType, sizeId, colour, clarity, value, label }: {
  stoneType: string; sizeId: string; colour: string; clarity: string; value: number | null; label: string;
}) {
  const shown = value === null ? '' : String(value);
  const [text, setText] = useState(shown);
  const [saved, setSaved] = useState(shown);
  const [pending, start] = useTransition();

  const save = () => {
    if (text.trim() === saved) return;
    start(async () => {
      const res = await setPriceAction({ stoneType, sizeId, colour, clarity, price: text });
      if ('error' in res) { toast.error(res.error); setText(saved); return; }
      const next = res.ok === null ? '' : String(res.ok);
      setSaved(next); setText(next);
    });
  };

  return (
    <Input
      aria-label={`${sizeId} ${label} price per carat`} inputMode="decimal" placeholder="—"
      value={text} disabled={pending} onChange={(e) => setText(e.target.value)} onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setText(saved); e.currentTarget.blur(); }
      }}
      className={cn('ml-auto h-8 w-28 text-right tabular-nums', text.trim() !== saved && 'border-primary')}
    />
  );
}
