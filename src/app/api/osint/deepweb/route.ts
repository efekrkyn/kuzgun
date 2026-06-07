import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('target') || '').trim();
  if (!target) return NextResponse.json({ error: 'Eksik hedef parametresi' }, { status: 400 });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 8, 60_000)) return NextResponse.json({ error: 'Limit aşıldı' }, { status: 429 });

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  
  // Parallel Fetching for Option A: Passive Safe Deep Web / Dark Web OSINT
  const promises: any[] = [];

  // 1. Ahmia Dark Web Search
  promises.push(
    fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(target)}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) })
      .then(r => r.ok ? r.text() : '')
      .then(html => {
        const results = [];
        const itemRegex = /<li class="searchResultsItem">([\s\S]*?)<\/li>/g;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
          const titleMatch = match[1].match(/<h4><a href="[^"]*redirect_url=([^"]+)">([^<]+)<\/a><\/h4>/);
          if (titleMatch) results.push({ url: decodeURIComponent(titleMatch[1]), title: titleMatch[2].trim().replace(/\n/g, '') });
        }
        return { source: 'Ahmia (Dark Web)', results };
      })
      .catch(() => ({ source: 'Ahmia (Dark Web)', results: [] }))
  );

  // 2. XposedOrNot (Data Breaches & Pastes) - works best for emails
  if (isEmail) {
    promises.push(
      fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(target)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => ({ source: 'XposedOrNot (Data Breaches)', results: data?.BreachesDetails || [] }))
        .catch(() => ({ source: 'XposedOrNot (Data Breaches)', results: [] }))
    );
    promises.push(
      fetch(`https://api.xposedornot.com/v1/paste/email/${encodeURIComponent(target)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => ({ source: 'Pastebin Sızıntıları', results: data?.searchResult || [] }))
        .catch(() => ({ source: 'Pastebin Sızıntıları', results: [] }))
    );
  }

  // 3. GitHub Secret Search (if not email, search code for secrets)
  if (!isEmail && process.env.GITHUB_TOKEN) {
    promises.push(
      fetch(`https://api.github.com/search/code?q=${encodeURIComponent(target + ' "password" OR "secret"')}&per_page=5`, {
        headers: { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'KUZGU' },
        signal: AbortSignal.timeout(10000)
      })
      .then(r => r.ok ? r.json() : null)
      .then(data => ({ source: 'GitHub Sızıntıları', results: data?.items?.map((i: any) => i.html_url) || [] }))
      .catch(() => ({ source: 'GitHub Sızıntıları', results: [] }))
    );
  }

  try {
    const results = await Promise.all(promises);
    
    let totalRiskScore = 0;
    const findings: any = {};
    
    results.forEach(r => {
      findings[r.source] = r.results;
      if (r.results.length > 0) totalRiskScore += (r.source.includes('Dark Web') ? 40 : 20);
    });

    totalRiskScore = Math.min(totalRiskScore, 100);

    return NextResponse.json({
      target,
      riskScore: totalRiskScore,
      riskLevel: totalRiskScore > 70 ? 'CRITICAL' : totalRiskScore > 30 ? 'HIGH' : totalRiskScore > 0 ? 'MEDIUM' : 'LOW',
      findings
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Deep Web taraması başarısız oldu.', detail: error.message }, { status: 502 });
  }
}
