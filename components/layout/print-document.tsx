import type { ReactNode } from 'react';
import { PrintButton } from '@/components/forms/print-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { business } from '@/lib/business';

export type PrintParty = {
  name: string; businessName?: string | null; address?: string | null;
  gstin?: string | null; phone?: string | null;
};

/**
 * One A4 sheet: letterhead and document number, who it is for, the lines, the
 * totals. On screen it sits on a grey desk with a Print button; on paper only
 * the sheet remains.
 */
export function PrintDocument({ title, number, meta, party, partyLabel, children, totals, note }: {
  title: string; number: string;
  meta: [string, string][];
  party: PrintParty; partyLabel: string;
  children: ReactNode;
  totals: [string, string, boolean?][];
  note?: string;
}) {
  return (
    <div className="mx-auto max-w-[210mm] py-8 print:py-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="space-y-8 bg-white p-[14mm] text-[12px] leading-relaxed text-neutral-900 shadow-sm print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-8">
          <div>
            <div className="text-lg font-semibold">{business.name}</div>
            {business.address && <div className="whitespace-pre-line text-neutral-600">{business.address}</div>}
            {business.gstin && <div className="text-neutral-600">GSTIN {business.gstin}</div>}
            {business.phone && <div className="text-neutral-600">{business.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{title}</div>
            <div className="tabular-nums text-neutral-600">{number}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 border-y border-neutral-200 py-4">
          <div>
            <div className="text-neutral-500">{partyLabel}</div>
            <div className="font-medium">{party.businessName || party.name}</div>
            {party.businessName && party.businessName !== party.name && <div>{party.name}</div>}
            {party.address && <div className="whitespace-pre-line text-neutral-600">{party.address}</div>}
            {party.gstin && <div className="text-neutral-600">GSTIN {party.gstin}</div>}
            {party.phone && <div className="text-neutral-600">{party.phone}</div>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-6 gap-y-1">
            {meta.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {children}

        <section className="ml-auto w-64 space-y-1">
          {totals.map(([k, v, strong]) => (
            <div key={k} className={`flex justify-between tabular-nums ${strong ? 'border-t border-neutral-300 pt-2 text-sm font-semibold' : ''}`}>
              <span className={strong ? '' : 'text-neutral-500'}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </section>

        {note && <p className="border-t border-neutral-200 pt-4 text-neutral-500">{note}</p>}
      </article>
    </div>
  );
}

/** The lines table every document shares. Paper keeps rules horizontal only. */
export function PrintLines({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const right = (i: number, n: number) => i >= n - 3;
  return (
    <Table className="print-lines">
      <TableHeader>
        <TableRow>
          {head.map((h, i) => <TableHead key={h} className={right(i, head.length) ? 'text-right' : ''}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((c, j) => <TableCell key={j} className={right(j, r.length) ? 'text-right tabular-nums' : ''}>{c}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
