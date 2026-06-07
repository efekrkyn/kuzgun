import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target')?.trim().replace('@', ''); // e.g. "durov" or "t.me/durov"
  
  if (!target) return NextResponse.json({ error: 'Eksik hedef parametresi' }, { status: 400 });

  // Clean target to just be the username
  const username = target.split('/').pop()?.split('?')[0];

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 15, 60_000)) return NextResponse.json({ error: 'Limit aşıldı' }, { status: 429 });

  try {
    // We scrape the Telegram Web Preview page (t.me/s/...)
    // /s/ is the preview route that contains the channel history and meta tags
    const previewUrl = `https://t.me/s/${username}`;
    
    const response = await fetch(previewUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      if (response.status === 404) return NextResponse.json({ error: 'Kanal veya kullanıcı bulunamadı.' }, { status: 404 });
      throw new Error(`Telegram API Hatası: ${response.status}`);
    }

    const html = await response.text();

    // Extract Metadata using Regex
    const titleMatch = html.match(/<meta property="og:title" content="(.*?)">/);
    const descMatch = html.match(/<meta property="og:description" content="(.*?)">/);
    const imgMatch = html.match(/<meta property="og:image" content="(.*?)">/);
    
    // Telegram web typically has a class "tgme_page_extra" for members/subscribers
    const extraMatch = html.match(/<div class="tgme_page_extra">(.*?)<\/div>/);

    const title = titleMatch ? titleMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'") : username;
    const description = descMatch ? descMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'") : 'Açıklama bulunamadı';
    const image = imgMatch ? imgMatch[1] : null;
    const stats = extraMatch ? extraMatch[1].replace(/<\/?[^>]+(>|$)/g, "") : 'İstatistik gizli veya bu bir kişisel hesap';

    // Look for linked groups, channels, or crypto wallets in the description
    const links = Array.from(description.matchAll(/t\.me\/[a-zA-Z0-9_]+/g)).map(m => m[0]);
    const cryptoWallets = Array.from(description.matchAll(/(bc1|[13])[a-zA-CH-Z0-9]{25,39}/g)).map(m => m[0]); // Basic BTC regex

    return NextResponse.json({
      target: username,
      title,
      description,
      stats,
      image,
      isChannel: stats.toLowerCase().includes('subscriber') || stats.toLowerCase().includes('member'),
      extracted_links: [...new Set(links)],
      extracted_wallets: [...new Set(cryptoWallets)]
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Telegram analizi başarısız oldu.', detail: error.message }, { status: 502 });
  }
}
