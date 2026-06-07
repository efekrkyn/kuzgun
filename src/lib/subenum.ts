/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Passive Subdomain Enumeration
 *
 *  Aggregates keyless passive DNS / certificate-transparency sources
 *  (the reliable subset used by projectdiscovery/subfinder and
 *  laramies/theHarvester) into one deduplicated result, then
 *  optionally resolves each host to flag which are live.
 *
 *  Sources: crt.sh · hackertarget · rapiddns · certspotter ·
 *           AlienVault OTX passive DNS · Wayback Machine CDX
 *
 *  All sources are best-effort (Promise.allSettled) — if one is down
 *  or rate-limits the host, the rest still return. Server-side only.
 * ═══════════════════════════════════════════════════════════════
 */

import { resolve4 } from 'node:dns/promises';
import { stealthHeaders } from './stealthFetch';

const TIMEOUT = 12_000;

export interface SubResult {
  host: string;
  sources: string[];
  ip: string | null;
  alive: boolean;
}

export interface SubEnumResult {
  domain: string;
  total: number;
  alive: number;
  sources: Record<string, number>;
  subdomains: SubResult[];
  elapsedMs: number;
}

function get(url: string, accept = 'application/json'): Promise<Response> {
  return fetch(url, { headers: stealthHeaders({ Accept: accept }), signal: AbortSignal.timeout(TIMEOUT) });
}

// Pull every hostname under `domain` out of an arbitrary text blob (CSV/HTML/text).
function extractHosts(text: string, domain: string): string[] {
  const re = new RegExp(`([a-z0-9_*-]+\\.)+${domain.replace(/\./g, '\\.')}`, 'gi');
  return (text.match(re) || []).map((h) => h.toLowerCase());
}

function clean(host: string, domain: string): string | null {
  let h = host.trim().toLowerCase().replace(/^\*\./, '').replace(/^\.+/, '').replace(/\.+$/, '');
  h = h.split('@').pop() as string; // drop any email local-part
  if (!h || h.includes('*') || h.includes('@') || h.includes(' ')) return null;
  if (!/^[a-z0-9.-]+$/.test(h)) return null;
  if (h !== domain && !h.endsWith('.' + domain)) return null;
  return h;
}

// ── sources ─────────────────────────────────────────────────────────
async function crtsh(domain: string): Promise<string[]> {
  const r = await get(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`);
  if (!r.ok) return [];
  const data = (await r.json()) as Array<{ name_value?: string; common_name?: string }>;
  const out: string[] = [];
  for (const row of data) {
    (row.name_value || '').split('\n').forEach((n) => out.push(n));
    if (row.common_name) out.push(row.common_name);
  }
  return out;
}

async function hackertarget(domain: string): Promise<string[]> {
  const r = await get(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(domain)}`, 'text/plain');
  if (!r.ok) return [];
  const text = await r.text();
  if (text.includes('API count exceeded') || text.includes('error')) return [];
  return text.split('\n').map((line) => line.split(',')[0]);
}

async function rapiddns(domain: string): Promise<string[]> {
  const r = await get(`https://rapiddns.io/subdomain/${encodeURIComponent(domain)}?full=1`, 'text/html');
  if (!r.ok) return [];
  return extractHosts(await r.text(), domain);
}

async function certspotter(domain: string): Promise<string[]> {
  const r = await get(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`);
  if (!r.ok) return [];
  const data = (await r.json()) as Array<{ dns_names?: string[] }>;
  return data.flatMap((d) => d.dns_names || []);
}

async function otx(domain: string): Promise<string[]> {
  const r = await get(`https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(domain)}/passive_dns`);
  if (!r.ok) return [];
  const data = (await r.json()) as { passive_dns?: Array<{ hostname?: string }> };
  return (data.passive_dns || []).map((p) => p.hostname || '');
}

async function wayback(domain: string): Promise<string[]> {
  const r = await get(`https://web.archive.org/cdx/search/cdx?url=*.${encodeURIComponent(domain)}&output=text&fl=original&collapse=urlkey&limit=10000`, 'text/plain');
  if (!r.ok) return [];
  return extractHosts(await r.text(), domain);
}

const SOURCES: Array<[string, (d: string) => Promise<string[]>]> = [
  ['crtsh', crtsh],
  ['hackertarget', hackertarget],
  ['rapiddns', rapiddns],
  ['certspotter', certspotter],
  ['otx', otx],
  ['wayback', wayback],
];

// ── bounded-concurrency DNS resolution ──────────────────────────────
async function resolveAll(hosts: string[], cap: number, concurrency: number): Promise<Map<string, string | null>> {
  const ips = new Map<string, string | null>();
  const targets = hosts.slice(0, cap);
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const h = targets[cursor++];
      try {
        const a = await resolve4(h);
        ips.set(h, a[0] || null);
      } catch {
        ips.set(h, null);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return ips;
}

export async function enumerateSubdomains(
  domain: string,
  opts: { resolve?: boolean; resolveCap?: number } = {},
): Promise<SubEnumResult> {
  const { resolve = true, resolveCap = 600 } = opts;
  const t0 = Date.now();

  const settled = await Promise.allSettled(SOURCES.map(([, fn]) => fn(domain)));

  // host -> set of sources
  const map = new Map<string, Set<string>>();
  const sourceCounts: Record<string, number> = {};
  settled.forEach((res, i) => {
    const name = SOURCES[i][0];
    if (res.status !== 'fulfilled') { sourceCounts[name] = 0; return; }
    let n = 0;
    for (const raw of res.value) {
      const h = clean(raw, domain);
      if (!h) continue;
      if (!map.has(h)) map.set(h, new Set());
      map.get(h)!.add(name);
      n++;
    }
    sourceCounts[name] = n;
  });

  const hosts = [...map.keys()].sort();
  let ips = new Map<string, string | null>();
  if (resolve) ips = await resolveAll(hosts, resolveCap, 50);

  const subdomains: SubResult[] = hosts.map((host) => {
    const ip = ips.get(host) ?? null;
    return { host, sources: [...map.get(host)!].sort(), ip, alive: ip !== null };
  });

  return {
    domain,
    total: subdomains.length,
    alive: subdomains.filter((s) => s.alive).length,
    sources: sourceCounts,
    subdomains,
    elapsedMs: Date.now() - t0,
  };
}
