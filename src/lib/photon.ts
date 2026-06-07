/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Web Crawler & Data Extractor (Photon port)
 *
 *  Native TypeScript port of s0md3v/Photon's core: crawl a site
 *  (same-host, bounded depth/pages) and extract intel from every
 *  page — emails, social profiles, external links, JS files, IPs,
 *  and likely API keys / secrets.
 *
 *  SSRF-guarded: the start host and every followed link is validated
 *  against the shared reserved-range blocklist; only same-host links
 *  are fetched (external links are recorded, never requested).
 * ═══════════════════════════════════════════════════════════════
 */

import { validateHost } from './ssrf-guard';
import { stealthHeaders } from './stealthFetch';

const TIMEOUT = 10_000;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const SCRIPT_RE = /<script[^>]+src=["']?([^"'\s>]+)/gi;
const HREF_RE = /<a[^>]+href=["']?([^"'\s>]+)/gi;

const SOCIAL_HOSTS = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
  'youtube.com', 'github.com', 't.me', 'tiktok.com', 'reddit.com',
  'pinterest.com', 'medium.com', 'discord.gg', 'vk.com',
];

// Targeted secret patterns (higher signal than raw entropy).
const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/g],
  ['Google OAuth token', /ya29\.[0-9A-Za-z_-]+/g],
  ['AWS access key', /AKIA[0-9A-Z]{16}/g],
  ['Slack token', /xox[baprs]-[0-9A-Za-z-]{10,48}/g],
  ['Stripe live key', /sk_live_[0-9a-zA-Z]{24}/g],
  ['JWT', /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
  ['Private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g],
  ['Generic api_key/secret', /["'](?:api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token)["']\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/gi],
];

export interface CrawlResult {
  target: string;
  pagesCrawled: number;
  emails: string[];
  social: string[];
  externalLinks: string[];
  jsFiles: string[];
  jsEndpoints: string[];
  ips: string[];
  secrets: Array<{ type: string; value: string; page: string }>;
  elapsedMs: number;
}

function uniqAdd(set: Set<string>, items: Iterable<string>) {
  for (const i of items) set.add(i);
}

function matchAll(text: string, re: RegExp): string[] {
  return (text.match(re) || []);
}

export async function crawlSite(
  target: string,
  opts: { maxPages?: number; maxDepth?: number; concurrency?: number } = {},
): Promise<CrawlResult> {
  const { maxPages = 25, maxDepth = 2, concurrency = 6 } = opts;
  const t0 = Date.now();

  const start = new URL(target.includes('://') ? target : `https://${target}`);
  const baseHost = start.hostname;

  const emails = new Set<string>();
  const social = new Set<string>();
  const externalLinks = new Set<string>();
  const jsFiles = new Set<string>();
  const ips = new Set<string>();
  const secrets: Array<{ type: string; value: string; page: string }> = [];
  const seenSecret = new Set<string>();

  const visited = new Set<string>();
  let frontier: Array<{ url: string; depth: number }> = [{ url: start.href, depth: 0 }];

  async function fetchPage(url: string): Promise<string | null> {
    try {
      const check = await validateHost(new URL(url).hostname);
      if (!check.ok) return null;
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT),
        headers: stealthHeaders({ Accept: 'text/html,*/*' }),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html') && !ct.includes('application/json') && !ct.includes('javascript')) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  function extract(html: string, pageUrl: string): string[] {
    uniqAdd(emails, matchAll(html, EMAIL_RE).map((e) => e.toLowerCase()));
    uniqAdd(ips, matchAll(html, IPV4_RE));

    for (const [type, re] of SECRET_PATTERNS) {
      for (const m of matchAll(html, re)) {
        const key = `${type}:${m}`;
        if (!seenSecret.has(key)) { seenSecret.add(key); secrets.push({ type, value: m.slice(0, 120), page: pageUrl }); }
      }
    }

    // scripts
    let m: RegExpExecArray | null;
    SCRIPT_RE.lastIndex = 0;
    while ((m = SCRIPT_RE.exec(html))) {
      try { jsFiles.add(new URL(m[1], pageUrl).href); } catch { /* ignore */ }
    }

    // links
    const internal: string[] = [];
    HREF_RE.lastIndex = 0;
    while ((m = HREF_RE.exec(html))) {
      let abs: URL;
      try { abs = new URL(m[1], pageUrl); } catch { continue; }
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
      const host = abs.hostname.replace(/^www\./, '');
      if (SOCIAL_HOSTS.some((s) => host === s || host.endsWith('.' + s))) {
        social.add(abs.href.split('?')[0]);
      }
      if (abs.hostname === baseHost) {
        internal.push(abs.href.split('#')[0]);
      } else {
        externalLinks.add(abs.protocol + '//' + abs.hostname);
      }
    }
    return internal;
  }

  for (let depth = 0; depth <= maxDepth && frontier.length && visited.size < maxPages; depth++) {
    const next: Array<{ url: string; depth: number }> = [];
    // process this depth level in bounded-concurrency batches
    const layer = frontier.filter((f) => !visited.has(f.url)).slice(0, maxPages - visited.size);
    let cursor = 0;
    async function worker() {
      while (cursor < layer.length && visited.size < maxPages) {
        const item = layer[cursor++];
        if (visited.has(item.url)) continue;
        visited.add(item.url);
        const html = await fetchPage(item.url);
        if (!html) continue;
        const internal = extract(html, item.url);
        if (depth < maxDepth) {
          for (const link of internal) {
            if (!visited.has(link)) next.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, layer.length) }, worker));
    frontier = next;
  }

  // ── JS Endpoint Extraction (Hakrawler inspired) ──
  const jsEndpoints = new Set<string>();
  const ENDPOINT_RE = /(?:"|')(\/[a-zA-Z0-9_?=&.\/-]{3,})(?:"|')/g;
  
  // Fetch up to 10 unique JS files to extract endpoints
  const jsToAnalyze = [...jsFiles].slice(0, 10);
  await Promise.all(jsToAnalyze.map(async (jsUrl) => {
    try {
      const res = await fetch(jsUrl, { signal: AbortSignal.timeout(5000), headers: stealthHeaders() });
      if (res.ok) {
        const jsText = await res.text();
        let em: RegExpExecArray | null;
        while ((em = ENDPOINT_RE.exec(jsText))) {
          if (!em[1].includes('<') && !em[1].includes('>') && !em[1].includes(' ')) {
            jsEndpoints.add(em[1]);
          }
        }
      }
    } catch { /* ignore */ }
  }));

  const cap = (s: Set<string>, n: number) => [...s].slice(0, n);
  return {
    target: start.href,
    pagesCrawled: visited.size,
    emails: [...emails],
    social: [...social],
    externalLinks: cap(externalLinks, 100),
    jsFiles: cap(jsFiles, 100),
    jsEndpoints: cap(jsEndpoints, 200),
    ips: [...ips].filter((ip) => !ip.startsWith('0.') && ip !== '127.0.0.1'),
    secrets,
    elapsedMs: Date.now() - t0,
  };
}
