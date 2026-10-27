import { notFound } from 'next/navigation';
import { PrintDocument, PrintLines } from '@/components/layout/print-document';
import { getMemo } from '@/features/memos/queries';
import { getParty } from '@/features/parties/queries';
import { ct, day, inr } from '@/lib/format';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PrintMemoPage({ params }: PageProps<'/print/memo/[id]'>) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const memo = await getMemo(id);
  if (!memo) notFound();
  const party = await getParty(memo.partyId);
  const out = memo.direction === 'out';

  return (
    <PrintDocument
      title={out ? 'Approval memo' : 'Memo received'}
      number={memo.memoNo}
      meta={[
        ['Issued', day(memo.issuedOn)],
        ...(memo.dueOn ? [['Return by', day(memo.dueOn)] as [string, string]] : []),
        ...(memo.agent ? [['Placed by', memo.agent] as [string, string]] : []),
      ]}
      party={{ name: memo.partyName, businessName: party?.businessName, address: party?.address, gstin: party?.gstin, phone: party?.phone }}
      partyLabel={out ? 'Sent to' : 'Received from'}
      totals={[
        ['Carats', ct(memo.carats)],
        ['Still out', ct(memo.outstanding)],
        ['Value at memo rate', inr(memo.value), true],
      ]}
      note={out ? 'Goods sent on approval. Please return them, or confirm the purchase, by the date above.' : undefined}
    >
      <PrintLines
        head={['Lot', 'Description', 'Carats', 'Rate (₹/ct)', 'Value']}
        rows={memo.lines.map((l) => [
          l.lotNo,
          [l.stoneType, l.sieveSize, l.mmSize && `${l.mmSize}mm`, l.shape].filter(Boolean).join(' · '),
          ct(l.carats),
          inr(l.rate),
          inr(l.carats * l.rate),
        ])}
      />
    </PrintDocument>
  );
}
