import { NextResponse } from 'next/server';
import translate from 'google-translate-api-x';
import crypto from 'crypto';

/**
 * KUZGU — Military-Grade Intelligence API
 * Fetches traditional intelligence / RSS feeds (SIGINT/OSINT News).
 */

const FALLBACK_FEEDS = {
  BBC: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  AlJazeera: 'https://www.aljazeera.com/xml/rss/all.xml',
  GDACS: 'https://www.gdacs.org/xml/rss.xml',
  TRTHaber: 'https://www.trthaber.com/manset_articles.rss',
  NTV: 'https://www.ntv.com.tr/son-dakika.rss',
  Haberturk: 'https://www.haberturk.com/rss',
  Sabah: 'https://www.sabah.com.tr/rss/sondakika.xml',
  Hurriyet: 'https://www.hurriyet.com.tr/rss/anasayfa',
  CNN: 'http://rss.cnn.com/rss/edition_world.rss',
  Guardian: 'https://www.theguardian.com/world/rss',
  NYT: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
};

const RISK_KEYWORDS = [
  'war','missile','strike','attack','crisis','tension','military','conflict','defense','clash','nuclear','invasion','bomb','drone','weapon','sanctions','ceasefire','escalation','killed','destroyed','operation','casualty','frontline','threat',
  'savaş','füze','saldırı','kriz','gerilim','askeri','çatışma','savunma','nükleer','işgal','bomba','iha','siha','silah','yaptırım','ateşkes','tırmanma','öldü','yok edildi','operasyon','kayıp','cephe','tehdit','terör','şehit','patlama','radar','çevirme','kaza'
];

const KEYWORD_COORDS: Record<string, [number, number]> = {
  'ukraine': [49.487, 31.272], 'kyiv': [50.450, 30.523], 'russia': [61.524, 105.318],
  'moscow': [55.755, 37.617], 'israel': [31.046, 34.851], 'gaza': [31.416, 34.333],
  'iran': [32.427, 53.688], 'lebanon': [33.854, 35.862], 'syria': [34.802, 38.996],
  'yemen': [15.552, 48.516], 'china': [35.861, 104.195], 'taiwan': [23.697, 120.960],
  'united states': [38.907, -77.036], 'europe': [48.800, 2.300], 'middle east': [31.500, 34.800],
  'ankara': [39.933, 32.859], 'istanbul': [41.008, 28.978], 'türkiye': [38.963, 35.243], 'turkey': [38.963, 35.243]
};

function scoreRisk(text: string): number {
  const lower = text.toLowerCase();
  let score = 1;
  for (const kw of RISK_KEYWORDS) {
    if (lower.includes(kw)) score += 2;
  }
  return Math.min(10, score);
}

function findCoords(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [keyword, coords] of Object.entries(KEYWORD_COORDS)) {
    if (lower.includes(keyword)) return coords;
  }
  return null;
}

function parseRSSItems(xml: string, sourceName: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };

    const title = getTag('title').replace(/<[^>]+>/g, '');
    const desc = getTag('description').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"');
    
    items.push({
      title: title.length > 100 ? title.substring(0, 100) + '...' : title,
      description: desc,
      link: getTag('link'),
      pubDate: getTag('pubDate') || new Date().toISOString(),
      source: sourceName
    });
  }
  return items;
}

let cache = { data: null as any, timestamp: 0 };
const CACHE_TTL = 60 * 1000; // 1 minute

export async function GET() {
  if (Date.now() - cache.timestamp < CACHE_TTL && cache.data) {
    return NextResponse.json({
      news: cache.data,
      total: cache.data.length,
      timestamp: new Date(cache.timestamp).toISOString(),
      cached: true
    });
  }

  try {
    const allArticles: any[] = [];

    const fallbackPromises = Object.entries(FALLBACK_FEEDS).map(async ([source, url]) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRSSItems(xml, source).slice(0, 10);
      } catch { return []; }
    });
    
    const fallbackResults = await Promise.allSettled(fallbackPromises);
    for (const result of fallbackResults) {
      if (result.status === 'fulfilled') allArticles.push(...result.value);
    }

    // Translate news sequentially
    const translatedNews = [];
    for (const article of allArticles) {
      const riskScore = scoreRisk(article.description || article.title);
      const coords = findCoords(article.description || article.title);

      let finalTitle = article.title;
      let finalDesc = article.description;
      try {
         const tTitle = await translate(article.title, { to: 'tr', rejectOnPartialFail: false });
         if (tTitle?.text) finalTitle = tTitle.text;
         if (article.description) {
           const tDesc = await translate(article.description, { to: 'tr', rejectOnPartialFail: false });
           if (tDesc?.text) finalDesc = tDesc.text;
         }
      } catch (e) {
         // ignore translate errors to avoid failing the whole API
      }

      translatedNews.push({
        id: crypto.createHash('md5').update((article.link || '') + (article.pubDate || '')).digest('hex'),
        title: finalTitle,
        description: finalDesc,
        link: article.link,
        published: article.pubDate,
        source: article.source,
        risk_score: riskScore,
        coords: coords ? [coords[0], coords[1]] : null,
        coords_default: !coords,
        machine_assessment: riskScore >= 8 ? "Yapay zeka analizine göre yüksek taktiksel öncelik (OSINT örüntüleri)." : null,
      });
    }

    translatedNews.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

    cache = { data: translatedNews, timestamp: Date.now() };

    return NextResponse.json({
      news: translatedNews,
      total: translatedNews.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return NextResponse.json({ news: [], error: 'Failed to fetch intel' }, { status: 500 });
  }
}
