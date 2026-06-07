import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp, validateHost } from '@/lib/ssrf-guard';
import { archiveUrl, ArchiveError } from '@/lib/archive';

// Web page archiver (SingleFile) — captures a URL into a single self-contained
// HTML file under public/archives/ for evidence preservation. SSRF-guarded.
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('url') || searchParams.get('target') || '').trim();
  if (!target) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

  let hostname: string;
  try {
    hostname = new URL(target.includes('://') ? target : `https://${target}`).hostname;
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  const check = await validateHost(hostname);
  if (!check.ok) return NextResponse.json({ error: `Blocked target — ${check.reason}` }, { status: 400 });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 5, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const result = await archiveUrl(target);
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof ArchiveError) return NextResponse.json({ error: e.message }, { status: e.status });
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Archive failed', detail }, { status: 502 });
  }
}
