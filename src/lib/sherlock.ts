/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Username Enumeration Engine ("Sherlock" port)
 *
 *  A native TypeScript reimplementation of the Sherlock detection
 *  logic. The intelligence lives entirely in the declarative
 *  `sherlock-data.json` manifest (sourced from the upstream
 *  sherlock-project/sherlock repo, MIT). We replicate the three
 *  detection strategies:
 *
 *    • status_code   — account exists when the probe returns 2xx
 *    • message       — account exists when NONE of the error strings
 *                      appear in the response body
 *    • response_url  — account exists when the final URL did not get
 *                      redirected to the site's known "not found" URL
 *
 *  Runs server-side only so target sites see the KUZGU host, never
 *  the operator's browser. Local-use OSINT — operator is responsible
 *  for lawful, authorized use (see SECURITY.md).
 * ═══════════════════════════════════════════════════════════════
 */

import manifest from './sherlock-data.json';
import { stealthHeaders } from './stealthFetch';

type ErrorType = 'status_code' | 'message' | 'response_url';

interface RawSite {
  url: string;
  urlMain?: string;
  urlProbe?: string;
  errorType: ErrorType;
  errorMsg?: string | string[];
  errorUrl?: string;
  errorCode?: number | number[];
  // maigret-style body detection: account exists if ANY presenseStr is in the
  // body; account does NOT exist if ANY absenceStr is in the body.
  presenseStrs?: string[];
  absenceStrs?: string[];
  regexCheck?: string;
  request_method?: string;
  request_payload?: Record<string, unknown>;
  headers?: Record<string, string>;
  isNSFW?: boolean;
  __comment__?: string | string[];
}

// Body-string detection shared by `message` and string-based `response_url`
// sites. Returns true when the response indicates the account EXISTS.
function bodyIndicatesFound(body: string, site: RawSite): boolean {
  const presence = site.presenseStrs;
  const absence = site.absenceStrs && site.absenceStrs.length
    ? site.absenceStrs
    : (site.errorMsg !== undefined ? asArray(site.errorMsg) : undefined);
  let found = true;
  if (presence && presence.length) found = presence.some((p) => body.includes(p));
  if (found && absence && absence.length) found = !absence.some((a) => body.includes(a));
  return found;
}

export interface SiteResult {
  site: string;
  url: string;        // human-facing profile URL
  urlMain?: string;
  status: 'found' | 'not_found' | 'error';
  http?: number;
  nsfw?: boolean;
  elapsedMs: number;
}

export interface HuntResult {
  username: string;
  found: SiteResult[];
  checked: number;
  total: number;
  errors: number;
  elapsedMs: number;
  truncated: boolean;
}

// ── Manifest parsing (once, cached in module scope) ────────────────
interface ParsedSite extends RawSite {
  name: string;
}

let SITES: ParsedSite[] | null = null;

function getSites(): ParsedSite[] {
  if (SITES) return SITES;
  const entries = manifest as Record<string, RawSite>;
  SITES = Object.entries(entries)
    .filter(([key, val]) => key !== '$schema' && val && typeof val === 'object' && 'url' in val)
    .map(([name, val]) => ({ name, ...val }));
  return SITES;
}

// ── Helpers ────────────────────────────────────────────────────────
function fill(template: string, username: string): string {
  // Sherlock substitutes the raw username; encode to stay URL-safe.
  return template.split('{}').join(encodeURIComponent(username));
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function stripQuery(u: string): string {
  const i = u.indexOf('?');
  return i === -1 ? u : u.slice(0, i);
}

// Collapse a URL to a scheme-agnostic host+path key so we can compare a
// manifest errorUrl (often schemeless, e.g. "wordpress.com/typo/?x=") against
// the actual final response URL.
function normKey(u: string): string {
  return stripQuery(u)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

// ── Single-site probe ──────────────────────────────────────────────
async function probe(
  site: ParsedSite,
  username: string,
  timeoutMs: number,
): Promise<SiteResult> {
  const t0 = Date.now();
  const displayUrl = fill(site.url, username);
  const probeUrl = site.urlProbe ? fill(site.urlProbe, username) : displayUrl;

  const base: SiteResult = {
    site: site.name,
    url: displayUrl,
    urlMain: site.urlMain,
    status: 'error',
    nsfw: site.isNSFW || false,
    elapsedMs: 0,
  };

  // Per-site username format gate — skip the network call entirely if the
  // username can't be valid on this site.
  if (site.regexCheck) {
    try {
      if (!new RegExp(site.regexCheck).test(username)) {
        return { ...base, status: 'not_found', elapsedMs: Date.now() - t0 };
      }
    } catch { /* bad regex in manifest — ignore the gate */ }
  }

  const method = (site.request_method || 'GET').toUpperCase();
  const init: RequestInit = {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: stealthHeaders(site.headers),
  };
  if (site.request_payload && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(site.request_payload);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(probeUrl, init);
    base.http = res.status;
    base.elapsedMs = Date.now() - t0;

    switch (site.errorType) {
      case 'status_code': {
        const codes = asArray(site.errorCode);
        const isErr = codes.length > 0
          ? codes.includes(res.status)
          : !(res.status >= 200 && res.status < 300);
        base.status = isErr ? 'not_found' : 'found';
        return base;
      }
      case 'response_url': {
        // A blocked / errored response can't confirm presence either way.
        if (res.status >= 400) { base.status = 'error'; return base; }
        if (site.errorUrl) {
          const errKey = normKey(fill(site.errorUrl, username));
          const finalKey = normKey(res.url);
          base.status = finalKey.startsWith(errKey) ? 'not_found' : 'found';
        } else if (site.presenseStrs || site.absenceStrs || site.errorMsg !== undefined) {
          // No errorUrl but maigret gave us body strings — detect on content.
          const body = await res.text();
          base.status = bodyIndicatesFound(body, site) ? 'found' : 'not_found';
        } else {
          base.status = res.status >= 200 && res.status < 300 ? 'found' : 'not_found';
        }
        return base;
      }
      case 'message': {
        // Body-string detection only holds for a genuine 2xx page. A
        // 403/429/redirect-to-login means the probe was blocked, not that the
        // user exists — mark it unknown so it never becomes a false positive.
        if (!(res.status >= 200 && res.status < 300)) { base.status = 'error'; return base; }
        const body = await res.text();
        base.status = bodyIndicatesFound(body, site) ? 'found' : 'not_found';
        base.elapsedMs = Date.now() - t0;
        return base;
      }
      default:
        return base;
    }
  } catch {
    base.status = 'error';
    base.elapsedMs = Date.now() - t0;
    return base;
  }
}

// ── Bounded-concurrency hunt across all sites ──────────────────────
export async function huntUsername(
  username: string,
  opts: {
    includeNsfw?: boolean;
    concurrency?: number;
    perSiteTimeoutMs?: number;
    deadlineMs?: number;
  } = {},
): Promise<HuntResult> {
  const {
    includeNsfw = false,
    concurrency = 80,
    perSiteTimeoutMs = 5000,
    deadlineMs = 90_000,
  } = opts;

  const t0 = Date.now();
  const all = getSites().filter((s) => includeNsfw || !s.isNSFW);
  const found: SiteResult[] = [];
  let checked = 0;
  let errors = 0;
  let truncated = false;

  // Sentinel: a syntactically valid username that almost certainly does not
  // exist anywhere. Used to unmask soft-404 sites (those that return 200 for
  // ANY username) so status_code hits can be validated against a control.
  const sentinel = 'zq' + Math.random().toString(36).slice(2, 9);

  let cursor = 0;
  async function worker() {
    while (cursor < all.length) {
      if (Date.now() - t0 > deadlineMs) { truncated = true; return; }
      const site = all[cursor++];
      const r = await probe(site, username, perSiteTimeoutMs);
      checked++;

      // Soft-404 guard (all detection types): a real hit must NOT reproduce
      // with a bogus username. If the same site also "finds" the sentinel, it
      // serves a generic 200 / always-match page → suppress the false hit.
      // Cost is bounded: only runs for sites that returned 'found'.
      if (r.status === 'found') {
        const ctrl = await probe(site, sentinel, perSiteTimeoutMs);
        if (ctrl.status === 'found') r.status = 'not_found';
      }

      if (r.status === 'found') found.push(r);
      else if (r.status === 'error') errors++;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, all.length) }, worker);
  await Promise.all(workers);

  found.sort((a, b) => a.site.localeCompare(b.site));

  return {
    username,
    found,
    checked,
    total: all.length,
    errors,
    elapsedMs: Date.now() - t0,
    truncated,
  };
}

export function siteCount(includeNsfw = false): number {
  return getSites().filter((s) => includeNsfw || !s.isNSFW).length;
}
