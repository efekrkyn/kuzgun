import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { huntEmail, emailCheckCount } from '@/lib/holehe';

// Email account enumeration (native port of megadose/holehe checks).
// Determines which services an email is registered on, without emailing them.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 8, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const [huntResult, breachRes, pasteRes] = await Promise.allSettled([
      huntEmail(email),
      fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.xposedornot.com/v1/paste/email/${encodeURIComponent(email)}`).then(r => r.ok ? r.json() : null)
    ]);

    const result = huntResult.status === 'fulfilled' ? huntResult.value : { error: 'Hunt failed', found: [] };
    const breaches = breachRes.status === 'fulfilled' && breachRes.value ? breachRes.value : null;
    const pastes = pasteRes.status === 'fulfilled' && pasteRes.value ? pasteRes.value : null;

    return NextResponse.json({ ...result, breaches, pastes });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Email hunt failed', detail }, { status: 502 });
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { 'X-Check-Count': String(emailCheckCount()) } });
}
