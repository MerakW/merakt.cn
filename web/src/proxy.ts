import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // The internal route owns DB access; assets and recovery/admin routes stay reachable.
  const response = await fetch(new URL('/api/site-availability', `http://127.0.0.1:${process.env.PORT || request.nextUrl.port || '3000'}`), {
    headers: { cookie: request.headers.get('cookie') || '', 'accept-language': request.headers.get('accept-language') || '' },
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  }).catch(() => null)
  if (response?.status === 503) return new NextResponse(await response.text(), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Retry-After': response.headers.get('Retry-After') || '120' } })
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api(?:/|$)|admin(?:/|$)|pit-wall(?:/|$)|manage(?:/|$)|_next(?:/|$)|maintenance-preview(?:/|$)|red-flag-preview(?:/|$)|status-preview(?:/|$)|.*\\.[^/]+$).*)'],
}
