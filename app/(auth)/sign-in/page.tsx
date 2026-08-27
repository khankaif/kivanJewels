import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CredentialsForm } from '@/features/auth/components/credentials-form';
import { signInWithEmail } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Aurum ERP — diamond trading &amp; jewellery</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CredentialsForm mode="sign-in" action={signInWithEmail} />
        <p className="text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/sign-up" className="underline underline-offset-4">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
