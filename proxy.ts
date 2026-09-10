import { auth } from '@/lib/auth/server';

// Next.js 16 uses proxy.ts in place of middleware.ts.
export default auth.middleware({
  loginUrl: '/sign-in',
});

export const config = {
  // Everything except the sign-in page, the auth API, and static assets.
  // There is no sign-up route: accounts come from Settings -> Staff.
  matcher: ['/((?!sign-in|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
