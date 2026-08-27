import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getParty, getPartyStatement, getPartyActivity } from '@/features/parties/queries';
import { getBills } from '@/features/bills/queries';
import { inr, ct } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** The source uses "Bill"/"Cash" as placeholders, not as document numbers. */
const realBillNo = (v: string | null) =>
  v && !['bill', 'cash'].includes(v.trim().toLowerCase()) ? v : null;

const KIND_LABEL: Record<string, string> = {
  sale_invoice: 'Sale bill', purchase_invoice: 'Purchase bill',
  payment_in: 'Received', payment_out: 'Paid', adjustment: 'Adjustment',
};

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await getParty(id);
  if (!party) notFound();

  const [statement, activity, bills] = await Promise.all([
    getPartyStatement(id), getPartyActivity(id), getBills({ partyId: id, limit: 200 }),
  ]);
  const unpaid = bills.rows.filter((b) => b.balance > 0.005);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/parties" className="text-sm text-muted-foreground underline underline-offset-4">
          ← All parties
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight">
          {party.name}
          <Badge variant="outline">{party.kind === 'both' ? 'supplier & client' : party.kind}</Badge>
          {!party.isActive && <Badge variant="secondary">inactive</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {party.defaultTermsDays}-day terms
          {party.phone && ` · ${party.phone}`}
          {party.gstin && ` · ${party.gstin}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="They owe me" value={inr(party.receivable)} tone="text-emerald-600" />
        <Stat label="I owe them" value={inr(party.payable)} tone="text-amber-600" />
        <Stat label="Net" value={inr(party.net)} tone={party.net >= 0 ? 'text-emerald-600' : 'text-amber-600'} />
        <Stat label="Stones traded" value={`${ct(activity.bought)} in · ${ct(activity.sold)} out`} />
      </div>

      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">Statement ({statement.length})</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid bills ({unpaid.length})</TabsTrigger>
          <TabsTrigger value="memos">Memos ({activity.memos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="statement">
          <Card>
            <CardHeader>
              <CardTitle>Statement of account</CardTitle>
              <CardDescription>
                Newest first. A positive running balance means they owe you.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Bill / ref</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="tabular-nums">{s.datedOn}</TableCell>
                      <TableCell>{KIND_LABEL[s.kind] ?? s.kind}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {realBillNo(s.billNo) ?? s.refId ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.amount > 0 ? inr(s.amount) : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.amount < 0 ? inr(-s.amount) : ''}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          s.running >= 0 ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {inr(s.running)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unpaid">
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill no.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaid.map((b) => (
                    <TableRow key={`${b.direction}:${b.billKey}`}>
                      <TableCell>
                        <Link
                          href={`/bills/${encodeURIComponent(b.billKey)}?direction=${b.direction}`}
                          className="font-mono text-xs underline underline-offset-4"
                        >
                          {b.billNo ?? 'Unnumbered'}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{b.billedOn ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{b.direction}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{inr(b.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-amber-600">
                        {inr(b.balance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {b.ageDays !== null ? `${b.ageDays}d` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!unpaid.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Nothing outstanding.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memos">
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Memo</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Carats</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.memos.map((m) => (
                    <TableRow key={m.memoId} className={m.overdue ? 'bg-red-50' : undefined}>
                      <TableCell className="font-mono text-xs">{m.memoNo}</TableCell>
                      <TableCell>
                        <Badge variant={m.direction === 'in' ? 'outline' : 'default'}>
                          {m.direction === 'in' ? 'from them' : 'to them'}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{m.issuedOn}</TableCell>
                      <TableCell className={`tabular-nums ${m.overdue ? 'font-semibold text-red-600' : ''}`}>
                        {m.dueOn ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{ct(m.carats)}</TableCell>
                      <TableCell className="text-right tabular-nums">{ct(m.outstanding)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(m.value)}</TableCell>
                    </TableRow>
                  ))}
                  {!activity.memos.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No memos with this party.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-lg font-bold tabular-nums ${tone ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
