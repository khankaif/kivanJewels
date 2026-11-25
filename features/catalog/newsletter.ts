'use server';

import { sql } from '@/db/client';

export type SignupState = { error: string } | { ok: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Store footer sign-up. Public and unauthenticated, so it only ever inserts
 * one short, validated row, and answers the same whether the address was new
 * or already listed (so it can't be used to check who is subscribed).
 */
export async function joinNewsletter(_prev: SignupState, fd: FormData): Promise<SignupState> {
  // Honeypot: a field hidden from people. Bots fill every input; pretend success.
  if (fd.get('website')) return { ok: 'Thank you.' };

  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { error: 'Enter a valid email address.' };

  // ponytail: no per-IP rate limit; the honeypot and one-row-per-address cap the
  // damage. Add one (like lib/auth/rate-limit) if sign-ups get spammed.
  try {
    await sql`INSERT INTO newsletter_signups (email) VALUES (${email}) ON CONFLICT DO NOTHING`;
  } catch (e) {
    // Log the real cause for us; the visitor only learns it didn't work.
    console.error('newsletter signup failed', e);
    return { error: 'Sign-up is unavailable right now. Please try again later.' };
  }
  return { ok: 'Thank you. We’ll be in touch.' };
}
