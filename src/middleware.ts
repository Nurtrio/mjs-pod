import { NextRequest, NextResponse } from 'next/server';

// Routes that DON'T need the dashboard password
const PUBLIC_PREFIXES = ['/driver', '/api', '/login', '/_next', '/icons', '/manifest.json', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public routes through
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p) || pathname === p)) {
    return NextResponse.next();
  }

  // Check auth cookie
  const auth = request.cookies.get('mjs-auth');
  if (auth?.value === 'authenticated') {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
