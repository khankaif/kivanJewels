'use client';

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { inr } from '@/lib/format';

const config = {
  in: { label: 'Received', color: 'var(--chart-1)' },
  out: { label: 'Paid out', color: 'var(--chart-2)' },
} satisfies ChartConfig;

type Point = { on: string; in: number; out: number };

/** Axis ticks only need magnitude: 5L, 1.2Cr, 40k. Exact figures are in the tooltip. */
const axis = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}${+(a / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${s}${+(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}k`;
  return `${s}${a}`;
};

const tick = (iso: string, range: 'd' | 'w' | 'm') => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (range === 'm') return d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', ...(range === 'w' ? { month: 'short' } : {}), timeZone: 'UTC' });
};

/**
 * Money in above the line, money out below it, one bar pair per period.
 * Reading the shape is the point: a run of red below the axis is a month of
 * paying suppliers that clients have not yet matched.
 */
export function CashChart({ data, range }: { data: Point[]; range: 'd' | 'w' | 'm' }) {
  const rows = data.map((p) => ({ ...p, out: -p.out }));
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={rows} stackOffset="sign" margin={{ left: 0, right: 4, top: 8 }} barCategoryGap="30%" maxBarSize={28}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="on" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16}
          tickFormatter={(v: string) => tick(v, range)}
        />
        <YAxis
          tickLine={false} axisLine={false} width={44}
          tickFormatter={axis}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={
            <ChartTooltipContent
              labelFormatter={(v) => tick(String(v), range)}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{config[name as 'in' | 'out']?.label}</span>
                  <span className="font-medium tabular-nums">{inr(Math.abs(Number(value)))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="in" stackId="cash" fill="var(--color-in)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="out" stackId="cash" fill="var(--color-out)" radius={[0, 0, 3, 3]} />
      </BarChart>
    </ChartContainer>
  );
}
