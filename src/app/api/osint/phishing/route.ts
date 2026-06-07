import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target')?.trim();
  
  if (!target) return NextResponse.json({ error: 'Eksik hedef marka/domain parametresi' }, { status: 400 });

  // Clean the target to just the main word (e.g., from "paypal.com" to "paypal")
  const brand = target.replace(/^https?:\/\//, '').split('.')[0];

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 5, 60_000)) return NextResponse.json({ error: 'Limit aşıldı' }, { status: 429 });

  try {
    // We query crt.sh (Certificate Transparency Logs) for anything containing the brand name
    // This is how phishing_catcher works: it monitors CT logs for typo-squatted domains
    const crtUrl = `https://crt.sh/?q=%25${encodeURIComponent(brand)}%25&output=json`;
    
    const response = await fetch(crtUrl, {
      headers: { 'User-Agent': 'KUZGU OSINT/1.0' },
      signal: AbortSignal.timeout(20000) // crt.sh can be slow
    });

    if (!response.ok) {
      throw new Error(`crt.sh API Hatası: ${response.status}`);
    }

    const data = await response.json();
    
    // Process and filter results
    const results = new Map();
    const exactDomainStr = `.${target.toLowerCase()}`;
    
    for (const entry of data) {
      const name = entry.name_value.toLowerCase();
      // We want to find phishing sites.
      // So if the user searched "paypal", we want "paypal-secure-login.com" 
      // but we probably want to ignore actual "www.paypal.com" (their legit subdomains).
      // However, seeing subdomains is also useful. We will separate them.
      
      const isLegitSubdomain = name.endsWith(exactDomainStr) || name === target.toLowerCase();
      
      if (!results.has(name)) {
        results.set(name, {
          domain: name,
          issuer: entry.issuer_name,
          date: entry.not_before,
          isPhishingRisk: !isLegitSubdomain
        });
      }
    }

    const uniqueDomains = Array.from(results.values());

    // Sort by date descending (newest certificates first)
    uniqueDomains.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const phishingRisks = uniqueDomains.filter(d => d.isPhishingRisk);
    const legitSubdomains = uniqueDomains.filter(d => !d.isPhishingRisk);

    return NextResponse.json({
      target: brand,
      total_found: uniqueDomains.length,
      phishing_risks_count: phishingRisks.length,
      phishing_risks: phishingRisks.slice(0, 50), // Top 50 newest phishing domains
      legit_subdomains: legitSubdomains.slice(0, 50)
    });

  } catch (error: any) {
    return NextResponse.json({ 
      target: brand, 
      phishing_risks: [], 
      legit_subdomains: [],
      total_found: 0,
      phishing_risks_count: 0,
      note: 'Kaynak (Wayback/crt.sh) yanıt vermedi veya bu IP\'yi limitledi; ev IP\'sinde tekrar dene.' 
    });
  }
}
