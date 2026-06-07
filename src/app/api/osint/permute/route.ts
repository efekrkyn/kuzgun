import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { generatePermutations } from '@/lib/permutations';

// Identity permutation generator — name → username/email permutations.
// Pure local computation (no network).
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get('name') || '').trim();
  if (!name) return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: 'Name too long' }, { status: 400 });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const result = generatePermutations({
    name,
    nick: searchParams.get('nick') || undefined,
    year: searchParams.get('year') || undefined,
    domain: searchParams.get('domain') || undefined,
  });
  return NextResponse.json({ name, ...result });
}
