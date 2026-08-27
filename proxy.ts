import { auth } from '@/lib/auth/server';

// Next.js 16 uses proxy.ts in place of middleware.ts.
export default auth.middleware({
  loginUrl: '/sign-in',
});

export const config = {
  // Everything except auth pages, the auth API, and static assets.
  matcher: ['/((?!sign-in|sign-up|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
