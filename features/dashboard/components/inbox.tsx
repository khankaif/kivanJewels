import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PaymentDialog } from '@/features/accounts/components/payment-dialog';
import { WhatsAppButton } from '@/components/forms/whatsapp-button';
import type { Todo, TodoKind } from '../queries';
import { ct, day, inr } from '@/lib/format';

const FILTERS: { key: TodoKind | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: 'collect', label: 'Collect' },
  { key: 'pay', label: 'Pay' },
  { key: 'memo_out', label: 'Memos' },
];

const KIND: Record<TodoKind, { label: string; tone: string }> = {
  collect: { label: 'Collect', tone: 'bg-positive-surface text-positive' },
  pay: { label: 'Pay', tone: 'bg-secondary text-secondary-foreground' },
  memo_out: { label: 'Client memo', tone: 'bg-warning-surface text-warning' },
  memo_in: { label: 'Supplier memo', tone: 'bg-secondary text-secondary-foreground' },
};

/**
 * Today's work as rows, each with the action that clears it. Counts on the
 * filters are the whole backlog; the table shows what to do first.
 */
export function Inbox({ items, counts, filter }: {
  items: Todo[]; counts: Record<TodoKind, number>; filter: TodoKind | null;
}) {
  const count = (k: TodoKind | null) =>
    k === null ? Object.values(counts).reduce((a, b) => a + b, 0)
      : k === 'memo_out' ? counts.memo_out + counts.memo_in : counts[k];

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-3">
        <CardTitle>To do</CardTitle>
        <CardDescription>Due this week or already late. Soonest first, then the freshest lateness.</CardDescription>
        <div className="col-span-full mt-2 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.label} size="xs" variant={f.key === filter ? 'secondary' : 'ghost'}
              aria-current={f.key === filter ? 'true' : undefined}
              nativeButton={false} render={<Link href={f.key ? `/?todo=${f.key}` : '/'} scroll={false} />}
            >
              {f.label} <span className="tabular-nums text-muted-foreground">{count(f.key)}</span>
            </Button>
          ))}
        </div>
      </CardHeader>
      {items.length === 0 ? (
        <Empty className="border-t py-10">
          <EmptyDescription>Nothing due this week. Nothing late.</EmptyDescription>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Due</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Party</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => (
              <TableRow key={t.key}>
                <TableCell className={t.daysLate > 0 ? 'text-negative' : undefined}>
                  {day(t.dueOn)}
                  {t.daysLate > 0 && <span className="ml-1.5 text-xs">{t.daysLate}d late</span>}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Badge className={KIND[t.kind].tone}>{KIND[t.kind].label}</Badge>
                    <Link href={t.href} className="hover:underline">{t.doc}</Link>
                    {t.carats !== null && <span className="text-muted-foreground">{ct(t.carats)}</span>}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={`/parties/${t.partyId}`} className="font-medium hover:underline">{t.partyName}</Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{inr(t.amount)}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1">
                    {(t.kind === 'collect' || t.kind === 'memo_out') && (
                      <WhatsAppButton
                        size="xs" label="" phone={t.partyPhone}
                        text={t.kind === 'collect'
                          ? `Hi ${t.partyName}, a reminder that ${t.billNo ? `bill ${t.billNo}` : 'our bill'} for ${inr(t.amount)} was due on ${day(t.dueOn)}. Thank you.`
                          : `Hi ${t.partyName}, memo ${t.doc}: ${ct(t.carats)} is with you, due back ${day(t.dueOn)}. Please return it or confirm the bill. Thank you.`}
                      />
                    )}
                    {(t.kind === 'collect' || t.kind === 'pay') ? (
                      <PaymentDialog
                        partyId={t.partyId} partyName={t.partyName}
                        direction={t.kind === 'collect' ? 'in' : 'out'} billNo={t.billNo}
                        outstanding={t.amount} size="sm" variant="outline"
                        label={t.kind === 'collect' ? 'Receive' : 'Pay'}
                      />
                    ) : (
                      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={t.href} />}>Settle</Button>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
