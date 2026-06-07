import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp, validateHost } from '@/lib/ssrf-guard';
import { runWebCheck, parseTarget } from '@/lib/webcheck';

// Consolidated web/domain analysis (native port of lissy93/web-check modules).
// One domain → SPF/DKIM/DMARC/BIMI, DNSSEC, security headers, HSTS, WAF,
// security.txt, redirect chain, Wayback history, Tranco rank, TXT records.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('target') || searchParams.get('domain') || '').trim();
  if (!target) {
    return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 15, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Parse + SSRF-validate the host before any work fans out.
  let hostname: string;
  try {
    hostname = parseTarget(target).hostname;
  } catch {
    return NextResponse.json({ error: 'Invalid target. Expected a domain or URL.' }, { status: 400 });
  }
  const check = await validateHost(hostname);
  if (!check.ok) {
    return NextResponse.json({ error: `Blocked target — ${check.reason}` }, { status: 400 });
  }

  try {
    const report = await runWebCheck(target);
    return NextResponse.json(report);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Web check failed', detail }, { status: 502 });
  }
}
