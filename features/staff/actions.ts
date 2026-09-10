'use server';

import { revalidatePath } from 'next/cache';
import { auth, currentUser } from '@/lib/auth/server';

export type StaffState = { error: string } | { ok: string } | null;

/** Long enough to be worth having; the auth service enforces its own floor too. */
const MIN_PASSWORD = 12;

/**
 * Managing staff is admin-only, checked here and not merely hidden in the nav:
 * a server action is a URL, so anything guarded only by what the page renders
 * is not guarded at all.
 */
async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error('Not authenticated');
  if ((user as { role?: string }).role !== 'admin') {
    throw new Error('Only an admin can manage staff.');
  }
  return user;
}

/** Changing your OWN password needs a session, not a role. */
async function requireSelf() {
  const user = await currentUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

const fail = (e: { message?: string } | null, fallback: string): StaffState =>
  ({ error: e?.message || fallback });

export async function addStaffAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  await requireAdmin();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  // Two roles is what the auth service defines, and two is what this office
  // needs: an admin manages staff, a user does the day's work.
  const role = String(form.get('role') ?? 'user') === 'admin' ? 'admin' : 'user';

  if (!name) return { error: 'Enter their name.' };
  if (!email) return { error: 'Enter their email address.' };
  if (password.length < MIN_PASSWORD) {
    return { error: `Give them a password of at least ${MIN_PASSWORD} characters.` };
  }

  const { error } = await auth.admin.createUser({ email, name, password, role });
  if (error) return fail(error, 'Could not create that account.');

  revalidatePath('/settings/staff');
  return {
    ok: `${name} can now sign in. Send the password over a channel they trust and have them change it.`,
  };
}

export async function setStaffPasswordAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  await requireAdmin();
  const userId = String(form.get('userId') ?? '');
  const newPassword = String(form.get('newPassword') ?? '');
  if (!userId) return { error: 'Pick the staff member.' };
  if (newPassword.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };

  const { error } = await auth.admin.setUserPassword({ userId, newPassword });
  if (error) return fail(error, 'Could not set that password.');

  revalidatePath('/settings/staff');
  return { ok: 'Password reset. They will need the new one at their next sign-in.' };
}

/** Access off, history kept: someone who leaves must not vanish from the audit trail. */
export async function setStaffAccessAction(form: FormData): Promise<void> {
  const me = await requireAdmin();
  const userId = String(form.get('userId') ?? '');
  const ban = String(form.get('ban') ?? '') === '1';
  // Locking yourself out is the one mistake nobody else can undo for you.
  if (!userId || userId === me.id) return;

  if (ban) await auth.admin.banUser({ userId });
  else await auth.admin.unbanUser({ userId });
  revalidatePath('/settings/staff');
}

export async function changeMyPasswordAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  await requireSelf();
  const currentPassword = String(form.get('currentPassword') ?? '');
  const newPassword = String(form.get('newPassword') ?? '');
  if (!currentPassword) return { error: 'Enter your current password.' };
  if (newPassword.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (newPassword === currentPassword) return { error: 'That is the password you already have.' };

  // revokeOtherSessions: changing a password should end every session that had
  // the old one, on any device.
  const { error } = await auth.changePassword({
    currentPassword, newPassword, revokeOtherSessions: true,
  });
  if (error) return fail(error, 'Could not change your password.');

  return { ok: 'Password changed. Other devices have been signed out.' };
}
