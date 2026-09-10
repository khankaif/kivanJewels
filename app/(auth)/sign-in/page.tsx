import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CredentialsForm } from '@/features/auth/components/credentials-form';
import { signInWithEmail } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Kaivan Jewels — diamond trading &amp; jewellery</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CredentialsForm action={signInWithEmail} />
        {/* Accounts are created by an admin in Settings → Staff. Self sign-up
            would let anyone who finds the URL into the whole book. */}
        <p className="text-sm text-muted-foreground">
          Staff accounts are issued by the office. Ask an admin if you need access or a password reset.
        </p>
      </CardContent>
    </Card>
  );
}
