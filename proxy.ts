import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';

// Next.js 16 uses proxy.ts in place of middleware.ts.
const requireLogin = auth.middleware({ loginUrl: '/sign-in' });

/**
 * One app, two hosts.
 *
 * STORE_HOST (e.g. catalog.example.com, or catalog.localhost:3000 in dev) is
 * the public storefront: every path is rewritten under /store and no session
 * is read, so nothing outside app/store is reachable there.
 *
 * Every other host is the ERP and stays default-deny behind the login. /store
 * is not served there: its links are written for the store host's root.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isStorePath = pathname === '/store' || pathname.startsWith('/store/');

  if (process.env.STORE_HOST && req.headers.get('host') === process.env.STORE_HOST) {
    const url = req.nextUrl.clone();
    url.pathname = isStorePath ? pathname : `/store${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (isStorePath) return new NextResponse(null, { status: 404 });
  return requireLogin(req);
}

export const config = {
  // Everything except the sign-in page, the auth API, and static assets.
  // There is no sign-up route: accounts come from Settings -> Staff.
  matcher: ['/((?!sign-in|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
