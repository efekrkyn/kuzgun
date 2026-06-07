import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp, validateHost } from '@/lib/ssrf-guard';
import { crawlSite } from '@/lib/photon';

// Web crawler + data extractor (native port of s0md3v/Photon).
// Same-host bounded crawl → emails, social profiles, external links,
// JS files, IPs, likely secrets. SSRF-guarded.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('target') || searchParams.get('url') || '').trim();
  if (!target) {
    return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 6, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let hostname: string;
  try {
    hostname = new URL(target.includes('://') ? target : `https://${target}`).hostname;
  } catch {
    return NextResponse.json({ error: 'Invalid target. Expected a domain or URL.' }, { status: 400 });
  }
  const check = await validateHost(hostname);
  if (!check.ok) {
    return NextResponse.json({ error: `Blocked target — ${check.reason}` }, { status: 400 });
  }

  const maxPages = Math.min(Math.max(parseInt(searchParams.get('pages') || '25', 10), 1), 50);
  try {
    const result = await crawlSite(target, { maxPages });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Crawl failed', detail }, { status: 502 });
  }
}
