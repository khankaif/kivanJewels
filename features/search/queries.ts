import { sql, type PoolClientLike } from '@/db/client';

export type Hit = {
  kind: 'stock' | 'party' | 'bill' | 'requirement';
  label: string;
  sub: string;
  href: string;
  /** Stock only: start a sale with this parcel already picked. */
  sellHref?: string;
  /** Stock only: the parcel as a line you can paste to a client. */
  offer?: string;
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
          concat_ws(' · ', NULLIF(concat_ws(' ', colour, clarity), ''),
                    round(balance, 3)::text || ' ct ' ||
                      CASE WHEN source = 'memo_in' THEN 'on supplier memo' ELSE 'in vault' END,
                    CASE WHEN exposure > 0.0005 THEN round(exposure, 3)::text || ' ct with clients' END) AS sub,
          '/stock/' || lot_no AS href,
          lot_id::text AS lot_id,
          concat_ws(' ', stone_type, spec_sieve(sieve_size), NULLIF(spec_mm(mm_size),'') || 'mm',
                    shape, colour, clarity, CASE WHEN lab IS NOT NULL THEN lab || ' cert' END) AS spec,
          round(balance, 3)::text AS carats
     FROM lot_balances
     -- Every word must match some part of the parcel, so "9-9.5 rd def vvs"
     -- narrows the way a trader's request does. Shapes and clarities resolve
     -- through the master's aliases ("rd", "rbc"); a run of colour letters
     -- ("def") matches any colour inside it.
    WHERE balance > 0.0005
      AND NOT EXISTS (
        SELECT 1 FROM unnest($2::text[]) t
         -- COALESCE: a blank field compares as NULL, and NOT (NULL) would let
         -- every word "match" a parcel that has no colour.
         WHERE NOT COALESCE((
           sieve_size ILIKE t || '%' OR mm_size ILIKE t || '%' OR lot_no ILIKE '%' || t || '%'
           OR shape ILIKE t || '%' OR shape = master_value('shape', t)
           OR clarity ILIKE t || '%' OR clarity = master_value('clarity', t)
           OR stone_type ILIKE t || '%' OR stone_type = master_value('stone_type', t)
           OR colour ILIKE t
           OR (t ~* '^[d-z]{2,5}$' AND colour <> '' AND strpos(lower(t), lower(colour)) > 0)
           OR party_name ILIKE t || '%'), false))
    ORDER BY (source = 'memo_in'), balance DESC LIMIT ${LIMIT})
  UNION ALL
  (SELECT 'party', 2, name, COALESCE(business_name, kind), '/parties/' || id, NULL, NULL, NULL
     FROM parties
    WHERE name ILIKE $1 OR business_name ILIKE $1
    ORDER BY name LIMIT ${LIMIT})
  UNION ALL
  (SELECT 'bill', 3, COALESCE(bill_no, 'unnumbered'),
          party_name || ' · ' || direction, '/accounts/bills/' || bill_key, NULL, NULL, NULL
     FROM bills
    WHERE bill_no ILIKE $1 OR party_name ILIKE $1
    ORDER BY billed_on DESC NULLS LAST LIMIT ${LIMIT})
  UNION ALL
  (SELECT * FROM (
     SELECT DISTINCT ON (requirement_no) 'requirement' AS kind, 4 AS ord, requirement_no AS label,
            party_name || ' · ' || requirement_status AS sub, '/sales/' || requirement_no AS href,
            NULL, NULL, NULL
       FROM requirement_line_status
      WHERE requirement_no ILIKE $1 OR party_name ILIKE $1
      ORDER BY requirement_no DESC LIMIT ${LIMIT}) r)
  ORDER BY ord`;

/** Pass a transaction client to read uncommitted rows; tests need that. */
export async function search(q: string, c?: PoolClientLike): Promise<Hit[]> {
  const term = q.trim();
  if (!term) return [];
  const params = [`%${term}%`, term.toLowerCase().split(/\s+/).filter(Boolean)];
  const rows = c
    ? (await c.query(SEARCH_SQL, params)).rows
    : await sql.query(SEARCH_SQL, params);

  return rows.map((r: any) => ({
    kind: r.kind, label: r.label ?? '—', sub: r.sub ?? '', href: encodeURI(r.href),
    ...(r.kind === 'stock' && {
      sellHref: `/sales?new=1&lot=${r.lot_id}`,
      offer: `Available: ${r.spec} — ${Number(r.carats).toFixed(3)} ct`,
    }),
  }));
}
