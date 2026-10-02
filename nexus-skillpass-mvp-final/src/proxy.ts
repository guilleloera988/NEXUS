import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE, verifyDemoSession } from '@/lib/server/demo-session';
import { demoMode, supabaseConfig } from '@/lib/server/env';

const PRIVATE = /^\/(dashboard|challenges|workspace|validations|profile|my-skillpass|talent|organization|notifications|admin|onboarding)(\/|$)/;

/**
 * Refreshes the Supabase session cookie on every navigation and sends signed-out visitors
 * of private routes to /login. This is a convenience layer: authorization is enforced again
 * by the server (session lookup) and, above all, by RLS and RPC checks in PostgreSQL.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isPrivate = PRIVATE.test(request.nextUrl.pathname);
  let authenticated = false;

  if (demoMode() === 'local' && (await verifyDemoSession(request.cookies.get(DEMO_COOKIE)?.value))) authenticated = true;

  const config = supabaseConfig();
  if (config && !authenticated) {
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (updates) => {
          for (const { name, value } of updates) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of updates) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    authenticated = Boolean(data.user);
  }

  if (isPrivate) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (!authenticated) {
      const url = new URL('/login', request.url);
      url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
      const redirect = NextResponse.redirect(url);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|brand/|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|api/health).*)'],
};
