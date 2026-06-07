import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

function gh(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': 'KUZGU-Recon',
    Accept: 'application/vnd.github.v3.text-match+json', // Request text matches
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(10_000) });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('target') || '').trim().replace(/^@/, '');
  if (!target) return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const u = encodeURIComponent(target);
    
    // Check if user exists
    const userRes = await gh(`/users/${u}`);
    if (userRes.status === 404) return NextResponse.json({ error: 'GitHub kullanıcısı/kurumu bulunamadı.' }, { status: 404 });
    
    // Common secret patterns for GitHub Search API
    const queries = [
      `user:${u} "API_KEY"`,
      `user:${u} "AWS_SECRET"`,
      `user:${u} "password" extension:env`,
      `user:${u} "secret" extension:json`,
      `user:${u} extension:pem`,
      `user:${u} extension:key`
    ];

    // Execute searches concurrently (max 5-6 queries to avoid immediate secondary rate limit abuse)
    const results = await Promise.allSettled(
      queries.map(async (q) => {
        const res = await gh(`/search/code?q=${encodeURIComponent(q)}&per_page=5`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        return { query: q, data };
      })
    );

    const findings: any[] = [];
    let totalScanned = 0;

    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value.data.items) {
        totalScanned += r.value.data.total_count || 0;
        r.value.data.items.forEach((item: any) => {
          findings.push({
            repo: item.repository.full_name,
            file: item.name,
            path: item.path,
            url: item.html_url,
            // Extract the snippet that matched
            snippet: item.text_matches?.[0]?.fragment || 'Eşleşme detayı alınamadı.'
          });
        });
      }
    });

    // Remove exact duplicates
    const uniqueFindings = Array.from(new Map(findings.map(item => [item.url, item])).values());

    return NextResponse.json({
      target,
      total_matches: uniqueFindings.length,
      estimated_files: totalScanned,
      findings: uniqueFindings
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Git Secrets scan failed', detail: error.message }, { status: 502 });
  }
}
