'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { checkSignInAllowed, recordAttempt } from '@/lib/auth/rate-limit';

export type AuthState = { error: string } | null;

/** The client address as the proxy reports it. Null when it cannot be trusted. */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
}

export async function signInWithEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const ip = await clientIp();
  const throttle = await checkSignInAllowed(email, ip);
  if (throttle.blocked) {
    return {
      error: `Too many failed sign-ins. Try again in ${throttle.minutes} minute`
           + `${throttle.minutes === 1 ? '' : 's'}, or ask an admin to reset the password.`,
    };
  }

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    await recordAttempt(email, ip, false);
    if (error.code?.startsWith('NETWORK_')) {
      return { error: 'Cannot reach the auth server. Check NEON_AUTH_BASE_URL in .env.local.' };
    }
    // Deliberately vague: saying which half was wrong tells an attacker which
    // email addresses are real.
    return { error: 'Email or password is incorrect.' };
  }

  await recordAttempt(email, ip, true);
  redirect('/');
}

export async function signOut() {
  await auth.signOut();
  redirect('/sign-in');
}
