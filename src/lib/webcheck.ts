/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Web Check Engine
 *
 *  A native TypeScript port of the high-value, keyless modules from
 *  lissy93/web-check (MIT). Runs a single domain/URL through a battery
 *  of passive checks in parallel and returns one structured report:
 *
 *    mailConfig   — SPF / DKIM / DMARC / BIMI + MX provider detection
 *    dnssec       — DNSKEY / DS / RRSIG (AD flag) presence
 *    httpSecurity — presence of 10 security response headers
 *    hsts         — HSTS preload-list compatibility verdict
 *    firewall     — WAF / CDN fingerprint from response headers
 *    cookies      — Set-Cookie inspection
 *    securityTxt  — RFC 9116 security.txt discovery + parse
 *    redirects    — full redirect chain (SSRF-validated per hop)
 *    archives     — Wayback Machine history stats
 *    rank         — Tranco top-1M rank
 *    txtRecords   — all root TXT records
 *
 *  Every direct-to-target request is guarded by the shared SSRF
 *  validator so a hostname that resolves to a private/reserved IP is
 *  refused before any socket is opened.
 * ═══════════════════════════════════════════════════════════════
 */

import dns from 'node:dns/promises';
import { validateHost } from './ssrf-guard';
import { stealthHeaders } from './stealthFetch';

const UA = 'Mozilla/5.0 (compatible; KUZGU-WebCheck/1.0)';
const TIMEOUT = 10_000;

export interface WebCheckReport {
  target: string;
  hostname: string;
  url: string;
  timestamp: string;
  mailConfig: unknown;
  dnssec: unknown;
  httpSecurity: unknown;
  hsts: unknown;
  firewall: unknown;
  cookies: unknown;
  securityTxt: unknown;
  redirects: unknown;
  archives: unknown;
  rank: unknown;
  txtRecords: unknown;
}

// ── input normalisation ─────────────────────────────────────────────
export function parseTarget(input: string): { hostname: string; url: string } {
  const withScheme = input.includes('://') ? input : `https://${input}`;
  const u = new URL(withScheme);
  return { hostname: u.hostname, url: `${u.protocol}//${u.hostname}` };
}

const safeTxt = (name: string) => dns.resolveTxt(name).catch(() => [] as string[][]);

// ── DNS-JSON helper (Google DoH) ────────────────────────────────────
async function doh(name: string, type: string): Promise<any> {
  const res = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(TIMEOUT) },
  );
  return res.json();
}

// ── mail config (SPF / DKIM / DMARC / BIMI / MX provider) ───────────
const DKIM_SELECTORS = ['default', 'google', 'selector1', 'selector2', 'k1', 'k2', 's1', 's2', 'dkim', 'mail'];
const MX_PROVIDERS: Array<[RegExp, string]> = [
  [/google(mail)?\.com$/i, 'Google Workspace'],
  [/outlook\.com$|microsoft\.com$/i, 'Microsoft 365'],
  [/protonmail\.ch$|proton\.me$/i, 'ProtonMail'],
  [/zoho\.(com|eu|in)$/i, 'Zoho Mail'],
  [/yahoodns\.net$/i, 'Yahoo Mail'],
  [/mimecast\.com$/i, 'Mimecast'],
  [/pphosted\.com$/i, 'Proofpoint'],
  [/messagelabs\.com$/i, 'Broadcom Email Security'],
  [/iphmx\.com$/i, 'Cisco Email Security'],
  [/mailgun\.org$/i, 'Mailgun'],
  [/sendgrid\.net$/i, 'SendGrid'],
  [/barracudanetworks\.com$/i, 'Barracuda'],
];

async function mailConfig(domain: string) {
  try {
    const [mx, rootTxt, dmarc, bimi, ...dkimRaw] = await Promise.all([
      dns.resolveMx(domain).catch(() => [] as { exchange: string; priority: number }[]),
      safeTxt(domain),
      safeTxt(`_dmarc.${domain}`),
      safeTxt(`default._bimi.${domain}`),
      ...DKIM_SELECTORS.map((s) =>
        safeTxt(`${s}._domainkey.${domain}`).then((r) => {
          if (!r.length) return null;
          const txt = r[0].join('');
          if (/p=\s*(;|$)/.test(txt)) return null;
          return { selector: s, record: r[0].join('') };
        }),
      ),
    ]);
    const dkim = dkimRaw.filter(Boolean) as { selector: string; record: string }[];
    const spf = rootTxt.map((r) => r.join('')).filter((s) => s.toLowerCase().startsWith('v=spf1'));
    const seen = new Set<string>();
    const providers = mx.reduce<{ provider: string; value: string }[]>((out, { exchange }) => {
      const m = MX_PROVIDERS.find(([re]) => re.test(exchange));
      if (m && !seen.has(m[1])) { seen.add(m[1]); out.push({ provider: m[1], value: exchange }); }
      return out;
    }, []);
    return {
      spf: spf.length ? spf : null,
      dmarc: dmarc.length ? dmarc.map((r) => r.join('')) : null,
      bimi: bimi.length ? bimi.map((r) => r.join('')) : null,
      dkim: dkim.length ? dkim : null,
      mxRecords: mx,
      mailServices: providers,
    };
  } catch (e) {
    return { error: `Mail config lookup failed: ${(e as Error).message}` };
  }
}

// ── DNSSEC ──────────────────────────────────────────────────────────
async function dnssec(hostname: string) {
  try {
    const [dnskey, ds, a] = await Promise.all([doh(hostname, 'DNSKEY'), doh(hostname, 'DS'), doh(hostname, 'A')]);
    return {
      DNSKEY: { isFound: !!dnskey.Answer, answer: dnskey.Answer || null },
      DS: { isFound: !!ds.Answer, answer: ds.Answer || null },
      RRSIG: { isFound: !!a.AD },
    };
  } catch (e) {
    return { error: `DNSSEC lookup failed: ${(e as Error).message}` };
  }
}

// ── single live fetch → headers-derived checks ──────────────────────
const SEC_HEADERS: Record<string, string> = {
  'content-security-policy': 'contentSecurityPolicy',
  'strict-transport-security': 'strictTransportSecurity',
  'x-content-type-options': 'xContentTypeOptions',
  'x-frame-options': 'xFrameOptions',
  'x-xss-protection': 'xXSSProtection',
  'referrer-policy': 'referrerPolicy',
  'permissions-policy': 'permissionsPolicy',
  'cross-origin-opener-policy': 'crossOriginOpenerPolicy',
  'cross-origin-resource-policy': 'crossOriginResourcePolicy',
  'cross-origin-embedder-policy': 'crossOriginEmbedderPolicy',
};
const MIN_HSTS_AGE = 10886400;

function evalHsts(header: string | null) {
  if (!header) return { message: 'Site does not serve any HSTS header.', compatible: false, hstsHeader: null };
  const lower = header.toLowerCase();
  const maxAge = parseInt(lower.match(/max-age=(\d+)/)?.[1] || '0', 10);
  if (maxAge < MIN_HSTS_AGE) return { message: `max-age ${maxAge} is below the ${MIN_HSTS_AGE} minimum.`, compatible: false, hstsHeader: header };
  if (!lower.includes('includesubdomains')) return { message: 'Missing includeSubDomains.', compatible: false, hstsHeader: header };
  if (!lower.includes('preload')) return { message: 'Missing preload directive.', compatible: false, hstsHeader: header };
  return { message: 'Compatible with the HSTS preload list.', compatible: true, hstsHeader: header };
}

function detectWaf(h: Headers) {
  const server = (h.get('server') || '').toLowerCase();
  const checks: Array<[boolean, string]> = [
    [server.includes('cloudflare'), 'Cloudflare'],
    [server.includes('akamaighost'), 'Akamai'],
    [server.includes('sucuri') || !!h.get('x-sucuri-id') || !!h.get('x-sucuri-cache'), 'Sucuri'],
    [server.includes('barracudawaf'), 'Barracuda WAF'],
    [server.includes('big-ip'), 'F5 BIG-IP'],
    [server.includes('fortiweb'), 'Fortinet FortiWeb'],
    [server.includes('imperva') || !!h.get('x-iinfo'), 'Imperva'],
    [!!h.get('x-waf-event-info'), 'Reblaze WAF'],
    [(h.get('set-cookie') || '').includes('_citrix_ns_id'), 'Citrix NetScaler'],
    [server.includes('qrator'), 'QRATOR'],
    [server.includes('ddos-guard'), 'DDoS-Guard'],
    [server.includes('naxsi'), 'NAXSI'],
  ];
  const hit = checks.find(([cond]) => cond);
  return hit ? { hasWaf: true, waf: hit[1] } : { hasWaf: false };
}

async function liveHeaderChecks(url: string) {
  try {
    const check = await validateHost(new URL(url).hostname);
    if (!check.ok) throw new Error(check.reason);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: stealthHeaders({ 'User-Agent': UA }),
    });
    const h = res.headers;
    const httpSecurity = Object.fromEntries(
      Object.entries(SEC_HEADERS).map(([k, key]) => [key, !!h.get(k)]),
    );
    const setCookie = h.get('set-cookie');
    return {
      httpSecurity: { status: res.status, ...httpSecurity },
      hsts: evalHsts(h.get('strict-transport-security')),
      firewall: detectWaf(h),
      cookies: setCookie ? { present: true, raw: setCookie } : { present: false },
    };
  } catch (e) {
    const err = { error: (e as Error).message };
    return { httpSecurity: err, hsts: err, firewall: err, cookies: err };
  }
}

// ── security.txt (RFC 9116) ─────────────────────────────────────────
async function securityTxt(baseUrl: string) {
  const paths = ['/.well-known/security.txt', '/security.txt'];
  for (const path of paths) {
    try {
      const res = await fetch(new URL(path, baseUrl).toString(), {
        headers: { 'User-Agent': 'curl/8.0.0' },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.status !== 200) continue;
      const body = await res.text();
      if (body.toLowerCase().includes('<html')) continue;
      const fields: Record<string, string> = {};
      for (const line of body.split('\n')) {
        if (line.startsWith('#') || line.startsWith('-----') || !line.trim()) continue;
        const m = line.match(/^([^:]+):\s*(.+)$/);
        if (m) fields[m[1].trim()] = m[2].trim();
      }
      return { isPresent: true, foundIn: path, isPgpSigned: body.includes('BEGIN PGP SIGNED MESSAGE'), fields };
    } catch { /* try next path */ }
  }
  return { isPresent: false };
}

// ── redirect chain (SSRF-validated per hop) ─────────────────────────
async function redirects(url: string) {
  const chain = [url];
  let current = url;
  try {
    for (let i = 0; i < 12; i++) {
      const check = await validateHost(new URL(current).hostname);
      if (!check.ok) { return { redirects: chain, stopped: `blocked hop — ${check.reason}` }; }
      const res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { 'User-Agent': UA },
      });
      if (res.status < 300 || res.status >= 400) break;
      const loc = res.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).href;
      chain.push(current);
    }
    return { redirects: chain };
  } catch (e) {
    return { redirects: chain, error: (e as Error).message };
  }
}

// ── Wayback Machine archive stats ───────────────────────────────────
function tsToDate(ts: string): Date {
  return new Date(
    +ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8),
    +ts.slice(8, 10), +ts.slice(10, 12), +ts.slice(12, 14),
  );
}
async function archives(url: string) {
  try {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,statuscode,digest,length&collapse=timestamp:8&limit=20000`;
    const res = await fetch(cdx, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    // archive.org occasionally serves an HTML error/ratelimit page — guard the parse.
    const text = await res.text();
    let data: string[][];
    try { data = JSON.parse(text); } catch { return { skipped: 'Wayback Machine unavailable or rate-limited' }; }
    if (!Array.isArray(data) || data.length <= 1) {
      return { skipped: 'Never archived by the Wayback Machine' };
    }
    data.shift();
    const firstScan = tsToDate(data[0][0]);
    const lastScan = tsToDate(data[data.length - 1][0]);
    let prev: string | null = null;
    let changes = -1;
    for (const row of data) { if (row[2] !== prev) { prev = row[2]; changes++; } }
    return { firstScan, lastScan, daysArchived: data.length, changeCount: changes };
  } catch (e) {
    return { error: `Wayback lookup failed: ${(e as Error).message}` };
  }
}

// ── Tranco rank (keyless) ───────────────────────────────────────────
async function rank(hostname: string) {
  const lookup = async (d: string) => {
    const res = await fetch(`https://tranco-list.eu/api/ranks/domain/${d}`, { signal: AbortSignal.timeout(TIMEOUT) });
    return res.ok ? res.json() : null;
  };
  try {
    const fallback = hostname.startsWith('www.') ? hostname.slice(4) : `www.${hostname}`;
    const first = await lookup(hostname);
    if (first?.ranks?.length) return first;
    const second = await lookup(fallback).catch(() => null);
    if (second?.ranks?.length) return second;
    return { skipped: `${hostname} is not in the Tranco top 1M` };
  } catch (e) {
    return { error: `Tranco lookup failed: ${(e as Error).message}` };
  }
}

async function txtRecords(domain: string) {
  try {
    const r = await dns.resolveTxt(domain);
    return { records: r.map((x) => x.join('')) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── orchestrator ────────────────────────────────────────────────────
export async function runWebCheck(target: string): Promise<WebCheckReport> {
  const { hostname, url } = parseTarget(target);

  const [
    mailConfigR, dnssecR, liveR, securityTxtR, redirectsR, archivesR, rankR, txtR,
  ] = await Promise.all([
    mailConfig(hostname),
    dnssec(hostname),
    liveHeaderChecks(url),
    securityTxt(url),
    redirects(url),
    archives(url),
    rank(hostname),
    txtRecords(hostname),
  ]);

  return {
    target,
    hostname,
    url,
    timestamp: new Date().toISOString(),
    mailConfig: mailConfigR,
    dnssec: dnssecR,
    httpSecurity: liveR.httpSecurity,
    hsts: liveR.hsts,
    firewall: liveR.firewall,
    cookies: liveR.cookies,
    securityTxt: securityTxtR,
    redirects: redirectsR,
    archives: archivesR,
    rank: rankR,
    txtRecords: txtR,
  };
}
