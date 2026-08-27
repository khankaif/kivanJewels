import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CredentialsForm } from '@/features/auth/components/credentials-form';
import { signUpWithEmail } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Aurum ERP — diamond trading &amp; jewellery</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CredentialsForm mode="sign-up" action={signUpWithEmail} />
        <p className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/sign-in" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
