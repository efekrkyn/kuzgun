import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { huntX, xConfigured, XError } from '@/lib/twitter';

// X / Twitter profile + recent public posts via the official X API v2.
// Requires X_BEARER_TOKEN (pay-per-use is billed per read).
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get('username') || searchParams.get('user') || '').trim().replace(/^@/, '');
  if (!username) {
    return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid X handle (letters, digits, underscore, max 15)' }, { status: 400 });
  }
  if (!xConfigured()) {
    return NextResponse.json({ error: 'X API not configured (set X_BEARER_TOKEN)' }, { status: 503 });
  }

  const clientIp = getClientIp(req);
  // Tight limit — each call costs real money on pay-per-use.
  if (isRateLimited(clientIp, 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const tweets = Math.min(Math.max(parseInt(searchParams.get('tweets') || '5', 10), 0), 20);
  try {
    const result = await huntX(username, { tweets });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof XError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'X lookup failed', detail }, { status: 502 });
  }
}
