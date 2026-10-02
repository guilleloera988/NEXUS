import { NextResponse } from 'next/server';

/**
 * Redirect with a relative Location header. The browser resolves it against the URL it is on,
 * so the host never changes (behind proxies or with `--hostname`, request.url may name another
 * host, which would drop the session cookies).
 */
export function relativeRedirect(location: string, status: 302 | 303 | 307 = 307) {
  return new NextResponse(null, { status, headers: { Location: location } });
}
