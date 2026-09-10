'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { inr } from '@/lib/format';

/**
 * Carats × rate, with the amount worked out as you type. Every form that moves
 * goods asks for these two and every one of them used to leave the operator to
 * multiply in their head before checking the total on the bill.
 */
export function CaratsRate({
  id, defaultCarats = '', defaultRate = '', rateLabel = 'Rate (₹/ct)',
  onChange, className,
}: {
  id: string; defaultCarats?: string | number; defaultRate?: string | number;
  rateLabel?: string; onChange?: (v: { carats: number; rate: number }) => void;
  className?: string;
}) {
  const [carats, setCarats] = useState(String(defaultCarats));
  const [rate, setRate] = useState(String(defaultRate));
  const amount = Number(carats) * Number(rate);

  const set = (c: string, r: string) => {
    setCarats(c); setRate(r);
    onChange?.({ carats: Number(c) || 0, rate: Number(r) || 0 });
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-carats`}>Carats</Label>
          <Input
            id={`${id}-carats`} name="carats" type="number" step="0.001" min="0.001" required
            value={carats} onChange={(e) => set(e.target.value, rate)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-rate`}>{rateLabel}</Label>
          <Input
            id={`${id}-rate`} name="rate" type="number" step="0.01" min="0" required
            value={rate} onChange={(e) => set(carats, e.target.value)}
          />
        </div>
      </div>
      <p className="text-right text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {amount > 0 ? <>Amount <span className="font-medium text-foreground">{inr(amount)}</span></> : 'Amount —'}
      </p>
    </div>
  );
}

/** The same readout on its own, for forms that lay the two fields out themselves. */
export function Amount({ carats, rate }: { carats: number; rate: number }) {
  const amount = (Number(carats) || 0) * (Number(rate) || 0);
  return (
    <span className="tabular-nums" aria-live="polite">
      {amount > 0 ? inr(amount) : '—'}
    </span>
  );
}
