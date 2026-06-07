import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { parseImageExif, ExifError } from '@/lib/exif';

// Photo EXIF/metadata OSINT — image URL → camera, timestamp, GPS location.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = (searchParams.get('url') || searchParams.get('target') || '').trim();
  if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 15, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const result = await parseImageExif(url);
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof ExifError) return NextResponse.json({ error: e.message }, { status: e.status });
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'EXIF parse failed', detail }, { status: 502 });
  }
}
