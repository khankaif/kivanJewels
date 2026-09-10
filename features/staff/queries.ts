import { auth } from '@/lib/auth/server';

export type Staff = {
  id: string; name: string; email: string;
  role: string; banned: boolean; createdAt: string | null;
};

export type StaffList =
  | { ok: true; staff: Staff[] }
  /** Not an admin, or the auth service refused. The page says so; it does not crash. */
  | { ok: false; reason: string };

/**
 * Everyone with a login. Comes from Neon Auth, not from our database: the app
 * has no user table of its own, so the auth service is the only truth about
 * who exists.
 *
 * Listing users is an admin-only endpoint, so a non-admin gets a refusal rather
 * than an empty list -- those are different facts and the page shows different
 * things for them.
 */
export async function getStaff(): Promise<StaffList> {
  const { data, error } = await auth.admin.listUsers({ query: { limit: 200 } });
  if (error) return { ok: false, reason: error.message || 'Could not list staff.' };

  const users = (data as { users?: unknown[] } | undefined)?.users ?? [];
  return {
    ok: true,
    staff: (users as Record<string, unknown>[]).map((u) => ({
      id: String(u.id),
      name: String(u.name ?? ''),
      email: String(u.email ?? ''),
      role: String(u.role ?? 'user'),
      banned: Boolean(u.banned),
      createdAt: u.createdAt ? new Date(u.createdAt as string).toISOString().slice(0, 10) : null,
    })),
  };
}

/** Whether the signed-in user may manage staff at all. */
export async function amAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return (session?.user as { role?: string } | undefined)?.role === 'admin';
}
