import { notFound } from 'next/navigation';
import { PrintDocument, PrintLines } from '@/components/layout/print-document';
import { getBill, getBillLines } from '@/features/accounts/money';
import { getParty } from '@/features/parties/queries';
import { ct, day, inr } from '@/lib/format';

export default async function PrintBillPage({ params, searchParams }: PageProps<'/print/bill/[key]'>) {
  const billKey = decodeURIComponent((await params).key);
  const direction = (await searchParams).direction === 'purchase' ? 'purchase' : 'sale';
  const [bill, lines] = await Promise.all([getBill(billKey, direction), getBillLines(billKey, direction)]);
  if (!bill) notFound();
  const party = await getParty(bill.partyId);
  const items = lines.filter((l) => l.kind.endsWith('_invoice'));

  return (
    <PrintDocument
      // Not "Tax invoice": the book holds no GST, HSN or tax split, and a tax
      // invoice without them would be a false document.
      title={direction === 'sale' ? 'Invoice' : 'Purchase bill'}
      number={bill.billNo ?? (bill.isCash ? 'Cash sale' : 'Unnumbered')}
      meta={[
        ['Date', day(bill.billedOn)],
        ...(bill.dueOn ? [['Due', day(bill.dueOn)] as [string, string]] : []),
      ]}
      party={{ name: bill.partyName, businessName: party?.businessName, address: party?.address, gstin: party?.gstin, phone: party?.phone }}
      partyLabel={direction === 'sale' ? 'Billed to' : 'From'}
      totals={[
        ['Total', inr(bill.gross)],
        ...(bill.paid > 0.005 ? [['Received', inr(bill.paid)] as [string, string]] : []),
        ['Balance due', inr(bill.balance), true],
      ]}
    >
      <PrintLines
        head={['Item', 'Description', 'Carats', 'Rate (₹/ct)', 'Amount']}
        rows={items.map((l) => [
          l.lotNo ?? '—',
          [l.stoneType, l.shape, l.sieveSize].filter(Boolean).join(' · ') || l.notes || '—',
          l.carats !== null ? ct(l.carats) : '—',
          l.rate !== null ? inr(l.rate) : '—',
          inr(Math.abs(l.amount)),
        ])}
      />
    </PrintDocument>
  );
}
