import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

// Instagram profile lookup via a Python instaloader subprocess.
// Public metadata only; reads PUBLIC data. Requires `instaloader` installed
// (pip install instaloader). Optional IG_SESSION_USER for higher reliability.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SCRIPT = join(process.cwd(), 'scripts', 'ig_lookup.py');

function runLookup(username: string, posts: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(
      'python3',
      [SCRIPT, username, String(posts)],
      { timeout: 45_000, maxBuffer: 1024 * 1024, env: process.env },
      (err, stdout) => {
        const code = err && typeof (err as NodeJS.ErrnoException).code === 'number'
          ? (err as unknown as { code: number }).code
          : err ? 1 : 0;
        resolve({ code, out: (stdout || '').trim() });
      },
    );
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get('username') || searchParams.get('user') || '').trim().replace(/^@/, '').toLowerCase();
  if (!username) {
    return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 });
  }
  // Strict whitelist — value is passed as an execFile arg (no shell), but keep it tight.
  if (!/^[a-z0-9._]{1,30}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid Instagram username' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 6, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const posts = Math.min(Math.max(parseInt(searchParams.get('posts') || '0', 10), 0), 12);

  const { out } = await runLookup(username, posts);
  if (!out) {
    return NextResponse.json({ error: 'Instagram lookup produced no output (is instaloader installed?)' }, { status: 502 });
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(out);
  } catch {
    return NextResponse.json({ error: 'Failed to parse lookup output', detail: out.slice(0, 200) }, { status: 502 });
  }

  if (data.error) {
    const msg = String(data.error);
    const status = /not found/.test(msg) ? 404 : /login|blocked|ratelimit/i.test(msg) ? 429 : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json(data);
}
