import { sql, type PoolClientLike } from '@/db/client';

export type Hit = {
  kind: 'stock' | 'party' | 'bill' | 'requirement';
  label: string;
  sub: string;
  href: string;
};

const LIMIT = 6;

/**
 * One query behind Cmd-K. Ranked kind-first: you almost always mean the goods
 * or the party, not a document number that happens to contain the same digits.
 */
const SEARCH_SQL = `
  (SELECT 'stock' AS kind, 1 AS ord,
          COALESCE(NULLIF(concat_ws(' · ', spec_sieve(sieve_size),
                                    NULLIF(spec_mm(mm_size),'') || 'mm', shape), ''), lot_no) AS label,
          concat_ws(' · ', colour, clarity, round(balance,2)::text || ' ct') AS sub,
          '/stock/' || lot_no AS href
     FROM lot_balances
    WHERE source <> 'memo_in' AND balance > 0.0005
      AND (sieve_size ILIKE $1 OR mm_size ILIKE $1 OR shape ILIKE $1
           OR colour ILIKE $1 OR clarity ILIKE $1 OR lot_no ILIKE $1)
    ORDER BY balance DESC LIMIT ${LIMIT})
  UNION ALL
  (SELECT 'party', 2, name, COALESCE(business_name, kind), '/parties/' || id
     FROM parties
    WHERE name ILIKE $1 OR business_name ILIKE $1
    ORDER BY name LIMIT ${LIMIT})
  UNION ALL
  (SELECT 'bill', 3, COALESCE(bill_no, 'unnumbered'),
          party_name || ' · ' || direction, '/accounts/bills/' || bill_key
     FROM bills
    WHERE bill_no ILIKE $1 OR party_name ILIKE $1
    ORDER BY billed_on DESC NULLS LAST LIMIT ${LIMIT})
  UNION ALL
  (SELECT * FROM (
     SELECT DISTINCT ON (requirement_no) 'requirement' AS kind, 4 AS ord, requirement_no AS label,
            party_name || ' · ' || requirement_status AS sub, '/sales/' || requirement_no AS href
       FROM requirement_line_status
      WHERE requirement_no ILIKE $1 OR party_name ILIKE $1
      ORDER BY requirement_no DESC LIMIT ${LIMIT}) r)
  ORDER BY ord`;

/** Pass a transaction client to read uncommitted rows; tests need that. */
export async function search(q: string, c?: PoolClientLike): Promise<Hit[]> {
  const term = q.trim();
  if (!term) return [];
  const params = [`%${term}%`];
  const rows = c
    ? (await c.query(SEARCH_SQL, params)).rows
    : await sql.query(SEARCH_SQL, params);

  return rows.map((r: any) => ({
    kind: r.kind, label: r.label ?? '—', sub: r.sub ?? '', href: encodeURI(r.href),
  }));
}
