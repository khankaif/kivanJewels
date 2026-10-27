import Link from 'next/link';
import { RecordPanel } from '@/components/layout/record-panel';
import { PartyDialog } from '@/features/parties/components/party-dialog';
import { waLink } from '@/lib/whatsapp';
import { PageHeader } from '@/components/layout/page-header';
import { WhatsAppButton } from '@/components/forms/whatsapp-button';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getParty, getPartyStatement, getPartyActivity } from '@/features/parties/queries';
import { getBills } from '@/features/accounts/money';
import { PaymentDialog } from '@/features/accounts/components/payment-dialog';
import { inr, ct, day } from '@/lib/format';

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
    <div className="space-y-4">
      <PageHeader
        parent={{ href: '/parties', label: 'Parties' }}
        title={party.name}
        badges={
          <>
            <Badge variant="outline">{party.kind === 'both' ? 'Supplier & client' : party.kind === 'supplier' ? 'Supplier' : 'Client'}</Badge>
            {!party.isActive && <Badge variant="secondary">Inactive</Badge>}
          </>
        }
        actions={
          <>
            {party.receivable > 0.005 && (
              <WhatsAppButton
                phone={party.phone}
                text={`Hi ${party.name}, a gentle reminder that ${inr(party.receivable)} is outstanding`
                  + `${unpaid.filter((b) => b.direction === 'sale').length ? ` across ${unpaid.filter((b) => b.direction === 'sale').length} bills` : ''}. Thank you.`}
              />
            )}
            <PaymentDialog partyId={party.id} partyName={party.name} direction="in" size="sm" label="Record receipt" />
            <PaymentDialog partyId={party.id} partyName={party.name} direction="out" size="sm" label="Record payment" />
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* The record: facts on the left, once. Activity on the right. */}
        <aside className="lg:sticky lg:top-24">
          <RecordPanel
            lead={
              <>
                <div className="text-xs text-muted-foreground">{party.net >= 0 ? 'They owe you, net' : 'You owe them, net'}</div>
                <div className={`mt-1 text-2xl font-semibold leading-tight tabular-nums ${party.net < 0 ? 'text-negative' : ''}`}>
                  {inr(Math.abs(party.net))}
                </div>
              </>
            }
            sections={[
              { title: 'Balance', rows: [
                ['Owed to you', party.receivable > 0.005 && inr(party.receivable)],
                ['Owed by you', party.payable > 0.005 && inr(party.payable)],
                ['Stones bought', activity.bought > 0 && ct(activity.bought)],
                ['Stones sold', activity.sold > 0 && ct(activity.sold)],
              ] },
              { title: 'Details', rows: [
                ['Role', party.kind === 'both' ? 'Supplier & client' : party.kind === 'supplier' ? 'Supplier' : 'Client'],
                ['Terms', `${party.defaultTermsDays} days`],
                ['Business', party.businessName],
                ['Contact', party.contactPerson],
                ['Phone', party.phone && (
                  <a href={waLink('', party.phone)} target="_blank" rel="noreferrer" className="hover:underline">{party.phone}</a>
                )],
                ['Email', party.email && <a href={`mailto:${party.email}`} className="hover:underline">{party.email}</a>],
                ['GSTIN', party.gstin],
                ['PAN', party.pan],
                ['Address', party.address && <span className="whitespace-pre-line">{party.address}</span>],
                ['Notes', party.notes],
              ] },
            ]}
            footer={<PartyDialog party={party} />}
          />
        </aside>

        <div className="min-w-0">
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
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statement.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="tabular-nums">{day(s.datedOn)}</TableCell>
                          <TableCell>{KIND_LABEL[s.kind] ?? s.kind}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {realBillNo(s.billNo) ?? s.refId ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.mode ?? ''}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.amount > 0 ? inr(s.amount) : ''}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.amount < 0 ? inr(-s.amount) : ''}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
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
                              href={`/accounts/bills/${encodeURIComponent(b.billKey)}?direction=${b.direction}`}
                              className="font-mono text-xs hover:underline"
                            >
                              {b.billNo ?? 'Unnumbered'}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">{day(b.billedOn)}</TableCell>
                          <TableCell><Badge variant="outline">{b.direction}</Badge></TableCell>
                          <TableCell className="text-right tabular-nums">{inr(b.gross)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
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
                        <TableRow key={m.memoId} className={m.overdue ? 'bg-negative-surface' : undefined}>
                          <TableCell className="font-mono text-xs">{m.memoNo}</TableCell>
                          <TableCell>
                            <Badge variant={m.direction === 'in' ? 'outline' : 'default'}>
                              {m.direction === 'in' ? 'from them' : 'to them'}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">{day(m.issuedOn)}</TableCell>
                          <TableCell className={`tabular-nums ${m.overdue ? 'font-semibold text-negative' : ''}`}>
                            {day(m.dueOn)}
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
      </div>
    </div>
  );
}
