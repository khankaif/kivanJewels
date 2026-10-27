import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export type RecordSection = {
  title?: string;
  /** Rows with an empty value are left out, so a sparse record stays short. */
  rows: [label: string, value: ReactNode][];
};

/**
 * A record's properties, Twenty-style: a narrow panel of label / value rows in
 * titled sections, beside the record's activity. Facts live here once; the
 * activity side never repeats them.
 */
export function RecordPanel({ lead, sections, footer }: {
  /** The one figure that answers "where do we stand", above everything else. */
  lead?: ReactNode;
  sections: RecordSection[];
  footer?: ReactNode;
}) {
  return (
    <Card size="sm" className="gap-0 py-0">
      {lead && <div className="border-b px-4 py-3.5">{lead}</div>}
      {sections.map((s, i) => {
        const rows = s.rows.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
        if (!rows.length) return null;
        return (
          <section key={s.title ?? i} className="border-b px-4 py-3 last:border-b-0">
            {s.title && <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{s.title}</h3>}
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      {footer && <div className="border-t px-4 py-3">{footer}</div>}
    </Card>
  );
}
