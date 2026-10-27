import Link from 'next/link';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { getCashFlow, type CashRange } from '../queries';
import { CashChart } from './cash-chart';
import { inr, money } from '@/lib/format';
import { cn } from '@/lib/utils';

const RANGES: { key: CashRange; short: string; long: string }[] = [
  { key: 'd', short: 'D', long: 'last 30 days' },
  { key: 'w', short: 'W', long: 'last 12 weeks' },
  { key: 'm', short: 'M', long: 'last 12 months' },
];

export const parseRange = (v: unknown): CashRange => (['d', 'w', 'm'].includes(String(v)) ? v : 'm') as CashRange;

/** Money actually received and paid -- history, so it lives with the books, not on Today. */
export async function CashMovementCard({ range, basePath }: { range: CashRange; basePath: string }) {
  const flow = await getCashFlow(range);
  const received = flow.reduce((s, p) => s + p.in, 0);
  const paid = flow.reduce((s, p) => s + p.out, 0);
  const net = received - paid;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash movement</CardTitle>
        <CardAction>
          <ButtonGroup aria-label="Period">
            {RANGES.map((r) => (
              <Button
                key={r.key} size="xs" variant={r.key === range ? 'secondary' : 'ghost'}
                aria-current={r.key === range ? 'true' : undefined} title={r.long}
                nativeButton={false} render={<Link href={`${basePath}?range=${r.key}`} scroll={false} />}
              >
                {r.short}
              </Button>
            ))}
          </ButtonGroup>
        </CardAction>
        <div className="col-span-full mt-1">
          <div className={cn('text-2xl font-semibold leading-tight tabular-nums', net < 0 && 'text-negative')} title={inr(net)}>
            {net < 0 ? '−' : ''}{money(Math.abs(net))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="text-positive">{money(received)} received</span>, <span className="text-negative">{money(paid)} paid out</span>,
            {' '}{RANGES.find((r) => r.key === range)!.long}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <CashChart data={flow} range={range} />
      </CardContent>
    </Card>
  );
}
