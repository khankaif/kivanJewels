import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { MastersNav } from '@/features/masters/components/masters-nav';
import { getStaff } from '@/features/staff/queries';
import { changeMyPasswordAction } from '@/features/staff/actions';
import {
  AddStaffSheet, ChangeMyPassword, StaffRow,
} from '@/features/staff/components/staff-manager';
import { currentUser } from '@/lib/auth/server';
import { MAX_PER_EMAIL, WINDOW_MINUTES } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const [list, me] = await Promise.all([getStaff(), currentUser()]);
  const staff = list.ok ? list.staff : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title="Staff & access"
        description="Who can sign in, what they can do, and who posted what. Accounts are issued here — there is no sign-up page."
        actions={list.ok ? <AddStaffSheet /> : null}
      />

      <MastersNav />

      {list.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>{staff.length} {staff.length === 1 ? 'account' : 'accounts'}</CardTitle>
            <CardDescription>
              Revoking access keeps the person&apos;s history: every movement and ledger row they
              posted stays stamped with their name. Deleting them would orphan the trail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.map((s) => <StaffRow key={s.id} member={s} isMe={s.id === me?.id} />)}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Staff list unavailable</CardTitle>
            <CardDescription>{list.reason}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Managing staff is admin-only, and this account is not an admin yet. Somebody has to be
              first, and that cannot happen through the app: an admin is needed to appoint one.
            </p>
            <p>
              Grant it from a terminal with{' '}
              <code className="font-mono text-xs">npm run grant-admin -- you@example.com</code>,
              then reload this page. After that, admins are appointed here.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your password</CardTitle>
          <CardDescription>
            Changing it signs out every other device you are on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeMyPassword action={changeMyPasswordAction} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign-in protection</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          After {MAX_PER_EMAIL} failed attempts on one email address within {WINDOW_MINUTES} minutes,
          that address is locked out for the rest of the window; a single machine is cut off after 20
          failures across any accounts. A successful sign-in clears the count. Attempts are recorded
          in <code className="font-mono text-xs">auth_attempts</code>, so the limit survives a
          restart — an in-memory counter would not.
        </CardContent>
      </Card>
    </div>
  );
}
