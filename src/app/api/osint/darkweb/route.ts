import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').trim();
  if (!query) {
    return NextResponse.json({ error: 'Eksik arama parametresi' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 10, 60_000)) {
    return NextResponse.json({ error: 'Limit aşıldı.' }, { status: 429 });
  }

  try {
    const res = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      throw new Error('Ahmia arama motoruna ulaşılamadı.');
    }

    const html = await res.text();
    const results: any[] = [];

    // Ahmia uses <li class="searchResultsItem">
    const itemRegex = /<li class="searchResultsItem">([\s\S]*?)<\/li>/g;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1];
      
      // Extract title and URL
      const titleMatch = block.match(/<h4><a href="[^"]*redirect_url=([^"]+)">([^<]+)<\/a><\/h4>/);
      const descMatch = block.match(/<p>([\s\S]*?)<\/p>/);
      
      if (titleMatch) {
        const url = decodeURIComponent(titleMatch[1]);
        const title = titleMatch[2].trim().replace(/\n/g, ' ');
        const description = descMatch ? descMatch[1].replace(/<\/?(?:b|i|strong|em)>/g, '').trim().replace(/\n/g, ' ') : '';
        
        results.push({ title, url, description });
      }
    }

    return NextResponse.json({ query, count: results.length, results });

  } catch (err: any) {
    return NextResponse.json({ error: 'Dark Web araması başarısız oldu.', detail: err.message }, { status: 502 });
  }
}
