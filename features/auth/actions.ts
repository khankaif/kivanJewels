'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

export type AuthState = { error: string } | null;

export async function signInWithEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { error } = await auth.signIn.email({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) {
    if (error.code?.startsWith('NETWORK_')) {
      return { error: 'Cannot reach the auth server. Check NEON_AUTH_BASE_URL in .env.local.' };
    }
    return { error: error.message || 'Failed to sign in.' };
  }
  redirect('/');
}

export async function signUpWithEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  if (!email) return { error: 'Email address must be provided.' };

  const { error } = await auth.signUp.email({
    email,
    name: String(formData.get('name') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) return { error: error.message || 'Failed to create account.' };
  redirect('/');
}

export async function signOut() {
  await auth.signOut();
  redirect('/sign-in');
}
