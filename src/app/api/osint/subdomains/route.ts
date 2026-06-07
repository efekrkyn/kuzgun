import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { enumerateSubdomains } from '@/lib/subenum';

// Passive subdomain enumeration — aggregates keyless CT / passive-DNS sources
// (crt.sh, hackertarget, rapiddns, certspotter, AlienVault OTX, Wayback) and
// resolves discovered hosts to flag which are live.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = (searchParams.get('domain') || searchParams.get('target') || '').trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 8, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const resolve = searchParams.get('resolve') !== '0';
  try {
    const result = await enumerateSubdomains(domain, { resolve });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Subdomain enumeration failed', detail }, { status: 502 });
  }
}
