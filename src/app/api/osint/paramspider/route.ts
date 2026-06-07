import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let target = (searchParams.get('target') || '').trim();
  
  if (!target) return NextResponse.json({ error: 'Eksik hedef parametresi' }, { status: 400 });

  // Clean domain input (remove http/https and paths)
  target = target.replace(/^https?:\/\//, '').split('/')[0];

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 10, 60_000)) return NextResponse.json({ error: 'Limit aşıldı' }, { status: 429 });

  try {
    // Query Wayback Machine CDX API (simulating ParamSpider)
    // We look for all URLs of the domain, limited to 5000 to avoid huge payloads
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=*.${encodeURIComponent(target)}/*&collapse=urlkey&output=json&fl=original&filter=mimetype:text/html&limit=5000`;
    
    const response = await fetch(cdxUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Wayback API Hatası: ${response.statusText}`);
    }

    const data = await response.json();
    
    // First row is the header ["original"], skip it
    const urls = data.slice(1).map((row: string[]) => row[0]);

    // ParamSpider Core Logic: Filter only URLs containing parameters (e.g. ?id=1 or &page=2)
    // Exclude common static assets
    const excludeExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.css', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.avi'];
    
    const parameterizedUrls = urls.filter((url: string) => {
      if (!url.includes('?')) return false;
      const lowerUrl = url.toLowerCase();
      if (excludeExtensions.some(ext => lowerUrl.includes(ext))) return false;
      // Must contain a parameter assignment (key=value)
      if (!url.match(/\?[^=]+=/)) return false;
      return true;
    });

    // Deduplicate based on parameter keys (to avoid 1000 identical ?id=X URLs)
    const uniqueParams = new Map<string, string>();
    
    parameterizedUrls.forEach((url: string) => {
      try {
        const urlObj = new URL(url);
        // Create a signature based on domain + path + sorted parameter keys
        const paramKeys = Array.from(urlObj.searchParams.keys()).sort().join(',');
        const signature = `${urlObj.hostname}${urlObj.pathname}?${paramKeys}`;
        
        if (!uniqueParams.has(signature)) {
          uniqueParams.set(signature, url);
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    });

    const finalUrls = Array.from(uniqueParams.values());

    return NextResponse.json({
      target,
      total_found: parameterizedUrls.length,
      unique_vulnerable_params: finalUrls.length,
      urls: finalUrls.slice(0, 100) // Return top 100 unique signatures
    });

  } catch (error: any) {
    return NextResponse.json({ 
      target, 
      urls: [], 
      total_found: 0,
      unique_vulnerable_params: 0,
      note: 'Kaynak (Wayback/crt.sh) yanıt vermedi veya bu IP\'yi limitledi; ev IP\'sinde tekrar dene.' 
    });
  }
}
