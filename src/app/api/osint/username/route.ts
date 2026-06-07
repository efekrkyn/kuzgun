import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { huntUsername, siteCount } from '@/lib/sherlock';

// Username enumeration across ~480 sites (native Sherlock port).
// Keyless — every check is an unauthenticated probe of a public profile URL.
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get('username') || '').trim();
  const includeNsfw = searchParams.get('nsfw') === '1' || searchParams.get('nsfw') === 'true';

  if (!username) {
    return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 });
  }
  // Usernames across these sites are alnum + a few separators. Keep it tight
  // to avoid abuse / injection into URL templates.
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(username)) {
    return NextResponse.json(
      { error: 'Invalid username. Allowed: letters, digits, . _ - (2–40 chars)' },
      { status: 400 },
    );
  }

  const clientIp = getClientIp(req);
  // Heavy fan-out (one request triggers hundreds of outbound probes) — keep
  // the limit low. Matches the protective stance of the other OSINT routes.
  if (isRateLimited(clientIp, 5, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const result = await huntUsername(username, { includeNsfw });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Username hunt failed', detail }, { status: 502 });
  }
}

// Lightweight metadata (how many sites are in the manifest) for the UI.
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { 'X-Site-Count': String(siteCount(false)) },
  });
}
