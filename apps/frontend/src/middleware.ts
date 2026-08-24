import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const AUTH_COOKIE = 'reconcile_token';
const AUTH_PAGES = ['/login', '/register'];
const PROTECTED_PAGES = [
  '/overview',
  '/import',
  '/reconciliation',
  '/exceptions',
  '/activity',
  '/report',
];

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const secret = getSecret();

  if (!token || !secret) {
    return false;
  }

  try {
    await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = await isAuthenticated(request);

  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  const isProtectedPage = PROTECTED_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );

  if (isProtectedPage && !authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);

    const response = NextResponse.redirect(url);
    response.cookies.delete(AUTH_COOKIE);
    return response;
  }

  if (isAuthPage && authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/overview';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/overview/:path*',
    '/import/:path*',
    '/reconciliation/:path*',
    '/exceptions/:path*',
    '/activity/:path*',
    '/report/:path*',
    '/login',
    '/register',
  ],
};
