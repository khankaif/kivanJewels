import { sql } from '@/db/client';

/**
 * Sign-in throttling, recorded in the database rather than in memory: this app
 * runs as serverless functions, so an in-process counter would reset on every
 * cold start and protect nothing.
 *
 * Two windows, because they stop different things. Per email stops someone
 * guessing one person's password; per IP stops one machine spraying many
 * accounts. A successful sign-in clears the email's failures so a staff member
 * who mistypes twice and then gets in is not left locked out.
 */
export const MAX_PER_EMAIL = 5;
export const MAX_PER_IP = 20;
export const WINDOW_MINUTES = 15;

export type Throttle = { blocked: false } | { blocked: true; minutes: number };

export async function checkSignInAllowed(email: string, ip: string | null): Promise<Throttle> {
  // Cheap sweep: the window is all that matters, so old rows are noise.
  await sql`DELETE FROM auth_attempts WHERE at < now() - interval '1 day'`;

  const [row] = await sql`
    SELECT
      count(*) FILTER (WHERE lower(email) = lower(${email}))::int AS by_email,
      count(*) FILTER (WHERE ${ip}::text IS NOT NULL AND ip = ${ip})::int AS by_ip,
      EXTRACT(EPOCH FROM (
        MIN(at) FILTER (WHERE lower(email) = lower(${email}))
        + (${WINDOW_MINUTES} || ' minutes')::interval - now()
      )) AS email_wait
    FROM auth_attempts
    WHERE NOT ok AND at > now() - (${WINDOW_MINUTES} || ' minutes')::interval`;

  const byEmail = Number(row.by_email);
  const byIp = Number(row.by_ip);
  if (byEmail < MAX_PER_EMAIL && byIp < MAX_PER_IP) return { blocked: false };

  const seconds = Math.max(Number(row.email_wait ?? 0), 60);
  return { blocked: true, minutes: Math.ceil(seconds / 60) };
}

export async function recordAttempt(email: string, ip: string | null, ok: boolean): Promise<void> {
  if (ok) {
    await sql`DELETE FROM auth_attempts WHERE lower(email) = lower(${email}) AND NOT ok`;
    return;
  }
  await sql`INSERT INTO auth_attempts (email, ip, ok) VALUES (${email}, ${ip}, false)`;
}
