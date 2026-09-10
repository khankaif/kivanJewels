import { createNeonAuth } from '@neondatabase/auth/next/server';
import { setActorResolver } from '@/db/client';

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

setActorResolver(async () => (await currentUser())?.id ?? null);
