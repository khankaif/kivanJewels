import { createNeonAuth } from '@neondatabase/auth/next/server';
import { setActorResolver, sql } from '@/db/client';

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});

/**
 * The signed-in user, or null. Used to stamp `created_by` on every posting;
 * a failure to read the session must never block a write, so it resolves to
 * null rather than throwing.
 */
export async function currentUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

/**
 * The first line of every server action. An action is a URL, so a page that
 * merely hides a button guards nothing.
 */
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

/**
 * True when this user is an admin, read from the auth tables rather than the
 * session cookie: the cookie can predate a role change (or not carry the role
 * at all), and an admin appointed a minute ago should be one now.
 */
export async function isAdmin(user: { id?: string } | null): Promise<boolean> {
  if (!user?.id) return false;
  const [row] = await sql`SELECT role FROM neon_auth."user" WHERE id = ${user.id} AND NOT COALESCE(banned, false)`;
  return row?.role === 'admin';
}

/**
 * For actions only an admin may take. Checked in the action, not just hidden
 * in the page: a server action is a URL anyone signed in can post to.
 */
export async function requireAdmin(what: string) {
  const user = await requireUser();
  if (!(await isAdmin(user))) throw new Error(`Only an admin can ${what}.`);
  return user;
}

setActorResolver(async () => (await currentUser())?.id ?? null);
