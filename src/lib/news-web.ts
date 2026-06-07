/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — News & Web search tools for the AI agent
 *
 *  searchNews — GDELT Doc API (keyless, global news by keyword).
 *  searchWeb  — Brave Search API (needs free BRAVE_API_KEY).
 * ═══════════════════════════════════════════════════════════════
 */

// ── GDELT news (keyless, rate-limited to ~1 req / 5s → cache) ────────
interface NewsCacheEntry { at: number; data: any }
const newsCache = new Map<string, NewsCacheEntry>();
const NEWS_TTL = 5 * 60 * 1000;

export interface NewsArticle { title: string; url: string; source: string; date: string | null; language?: string; country?: string; }

export async function searchNews(query: string, opts: { timespan?: string; max?: number } = {}): Promise<{ query: string; articles: NewsArticle[] }> {
  const timespan = opts.timespan || '3d';
  const max = Math.min(Math.max(opts.max || 15, 1), 30);
  const key = `${query}|${timespan}|${max}`;
  const cached = newsCache.get(key);
  if (cached && Date.now() - cached.at < NEWS_TTL) return cached.data;

  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}` +
    `&mode=artlist&maxrecords=${max}&format=json&sort=datedesc&timespan=${encodeURIComponent(timespan)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KUZGU-News/1.0)' },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error('Haber servisi geçici olarak meşgul (GDELT 5sn limiti). Birazdan tekrar dene.');
  }
  const articles: NewsArticle[] = (json.articles || []).map((a: any) => ({
    title: a.title,
    url: a.url,
    source: a.domain,
    date: a.seendate || null,
    language: a.language,
    country: a.sourcecountry,
  }));
  const out = { query, articles };
  newsCache.set(key, { at: Date.now(), data: out });
  return out;
}

// ── Brave web search (needs free key) ───────────────────────────────
export interface WebResult { title: string; url: string; description: string; }

export async function searchWeb(query: string, max = 8): Promise<{ query: string; results: WebResult[] }> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    throw new Error('Web araması yapılandırılmamış (BRAVE_API_KEY gerekli).');
  }
  const n = Math.min(Math.max(max, 1), 15);
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${n}`, {
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Brave web search HTTP ${res.status}`);
  const json = await res.json();
  const results: WebResult[] = (json.web?.results || []).slice(0, n).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.description || '',
  }));
  return { query, results };
}

export const webSearchConfigured = () => !!process.env.BRAVE_API_KEY;
