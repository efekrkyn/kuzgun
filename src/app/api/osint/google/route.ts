import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { huntGoogle, GhuntError } from '@/lib/ghunt';

// Google account OSINT via GHunt (email → Gaia ID, profile, linked services).
// Requires GHunt installed + `ghunt login` done once.
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 6, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const result = await huntGoogle(email);
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof GhuntError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Google lookup failed', detail }, { status: 502 });
  }
}
