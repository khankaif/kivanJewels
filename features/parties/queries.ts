import { sql } from '@/db/client';

export type Party = {
  id: string; name: string; kind: 'supplier' | 'client' | 'both';
  defaultTermsDays: number; phone: string | null; email: string | null;
  gstin: string | null; notes: string | null; isActive: boolean;
  receivable: number; payable: number; net: number;
  openMemosIn: number; openMemosOut: number;
};

export async function getParties(opts: { search?: string; includeInactive?: boolean } = {}): Promise<Party[]> {
  const like = opts.search ? `%${opts.search}%` : null;
  const rows = await sql`
    SELECT p.id, p.name, p.kind, p.default_terms_days, p.phone, p.email,
           p.gstin, p.notes, p.is_active,
           COALESCE(b.receivable,0) AS receivable,
           COALESCE(b.payable,0)    AS payable,
           COALESCE(b.net,0)        AS net,
           COALESCE((SELECT count(*) FROM memos m
                     WHERE m.party_id = p.id AND m.direction='in'  AND m.status='open'),0)::int AS open_in,
           COALESCE((SELECT count(*) FROM memos m
                     WHERE m.party_id = p.id AND m.direction='out' AND m.status='open'),0)::int AS open_out
    FROM parties p
    LEFT JOIN party_balances b ON b.party_id = p.id
    WHERE (${opts.includeInactive ?? false}::boolean OR p.is_active)
      AND (${like}::text IS NULL OR p.name ILIKE ${like} OR p.phone ILIKE ${like} OR p.gstin ILIKE ${like})
    ORDER BY ABS(COALESCE(b.net,0)) DESC, p.name`;

  return rows.map((r: any) => ({
    id: r.id, name: r.name, kind: r.kind, defaultTermsDays: r.default_terms_days,
    phone: r.phone, email: r.email, gstin: r.gstin, notes: r.notes, isActive: r.is_active,
    receivable: Number(r.receivable), payable: Number(r.payable), net: Number(r.net),
    openMemosIn: r.open_in, openMemosOut: r.open_out,
  }));
}

/** Lightweight list for pickers. `kind` filters to who can play that role. */
export async function getPartyOptions(role?: 'supplier' | 'client') {
  const rows = await sql`
    SELECT id, name, default_terms_days FROM parties
    WHERE is_active
      AND (${role ?? null}::text IS NULL OR kind = 'both' OR kind = ${role ?? null})
    ORDER BY name`;
  return rows.map((r: any) => ({
    id: r.id, name: r.name, defaultTermsDays: r.default_terms_days,
  }));
}
