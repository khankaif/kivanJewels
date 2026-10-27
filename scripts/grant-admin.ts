/**
 * Appoints the first admin.
 *
 * This exists because the appointment cannot happen inside the app: managing
 * staff is admin-only, so with nobody holding the role there is no way in.
 * Neon Auth keeps its users in this same database (`neon_auth.user`), so the
 * role is a column we can set with the database credentials the owner already
 * has -- which is the right bar for handing out this power.
 *
 * After the first admin exists, appoint the rest in Settings -> Staff.
 *
 *   npm run grant-admin -- someone@example.com          # make admin
 *   npm run grant-admin -- someone@example.com --revoke # back to staff
 *   npm run grant-admin                                 # list accounts
 */
import { sql } from '../db/client';

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((a) => a.includes('@'))?.toLowerCase();

  if (!email) {
    const rows = await sql`
      SELECT email, name, role, banned FROM neon_auth.user ORDER BY "createdAt"`;
    if (!rows.length) {
      console.log('No accounts yet. Sign in once to create one, then run this again.');
      return;
    }
    console.log('Accounts:');
    for (const r of rows as { email: string; name: string; role: string; banned: boolean }[]) {
      console.log(
        `  ${r.email.padEnd(32)} ${(r.name ?? '').padEnd(18)} ${r.role ?? 'user'}` +
        `${r.banned ? '  (access revoked)' : ''}`,
      );
    }
    console.log('\nUsage: npm run grant-admin -- <email> [--revoke]');
    return;
  }

  const role = revoke ? 'user' : 'admin';
  const rows = await sql`
    UPDATE neon_auth.user SET role = ${role}, "updatedAt" = now()
    WHERE lower(email) = ${email}
    RETURNING email, name, role`;

  if (!rows.length) {
    console.error(`No account with that email. Run without arguments to list them.`);
    process.exitCode = 1;
    return;
  }
  const u = rows[0] as { email: string; role: string };
  console.log(`${u.email} is now ${u.role === 'admin' ? 'an admin' : 'ordinary staff'}.`);
  console.log('They must sign out and back in for the change to reach their session.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
