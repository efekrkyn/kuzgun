/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Email Account Enumeration ("holehe" port)
 *
 *  Native TypeScript port of selected megadose/holehe (GPL) checks.
 *  Each check probes a service's registration / password-recovery /
 *  account-status endpoint to determine whether an email address is
 *  registered there — WITHOUT sending the user any email.
 *
 *  Detection is per-site (no declarative manifest like Sherlock), so
 *  checks live in a registry of small async functions. Add more by
 *  appending to CHECKS. Result per site is 'exists' | 'not_found' |
 *  'rateLimit' (blocked / inconclusive).
 *
 *  Server-side only. Operator is responsible for lawful, authorized
 *  use (see SECURITY.md).
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from 'node:crypto';
import { stealthHeaders } from './stealthFetch';

export type CheckStatus = 'exists' | 'not_found' | 'rateLimit';

export interface CheckResult {
  site: string;
  domain: string;
  status: CheckStatus;
  elapsedMs: number;
}

interface CheckDef {
  site: string;
  domain: string;
  run: (email: string) => Promise<CheckStatus>;
}

const TIMEOUT = 8000;

function f(url: string, init: RequestInit = {}): Promise<Response> {
  const { headers, ...rest } = init;
  return fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT),
    ...rest,
    headers: stealthHeaders(headers as Record<string, string> | undefined),
  });
}

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

// ── Check registry ─────────────────────────────────────────────────
const CHECKS: CheckDef[] = [
  {
    site: 'Spotify', domain: 'spotify.com',
    run: async (email) => {
      const r = await f(`https://spclient.wg.spotify.com/signup/public/v1/account?validate=1&email=${encodeURIComponent(email)}`,
        { headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (j.status === 1) return 'not_found';
      if (j.status === 20) return 'exists';
      return 'rateLimit';
    },
  },
  {
    site: 'Twitter/X', domain: 'twitter.com',
    run: async (email) => {
      const r = await f(`https://api.twitter.com/i/users/email_available.json?email=${encodeURIComponent(email)}`);
      if (!r.ok) return 'rateLimit';
      const j = await r.json();
      return j.taken ? 'exists' : 'not_found';
    },
  },
  {
    site: 'Imgur', domain: 'imgur.com',
    run: async (email) => {
      const r = await f('https://imgur.com/signin/ajax_email_available', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://imgur.com' },
        body: `email=${encodeURIComponent(email)}`,
      });
      if (!r.ok) return 'rateLimit';
      const text = await r.text();
      let avail = false;
      try { avail = JSON.parse(text)?.data?.available; } catch { return 'rateLimit'; }
      if (avail || text.includes('Invalid email domain')) return 'not_found';
      return 'exists';
    },
  },
  {
    site: 'Pinterest', domain: 'pinterest.com',
    run: async (email) => {
      const data = encodeURIComponent(`{"options": {"email": "${email}"}, "context": {}}`);
      const r = await f(`https://www.pinterest.com/_ngjs/resource/EmailExistsResource/get/?source_url=%2F&data=${data}`);
      if (!r.ok) return 'rateLimit';
      const j = await r.json();
      const d = j?.resource_response?.data;
      if (typeof d === 'string' && d.includes('source_field')) return 'not_found';
      return d ? 'exists' : 'not_found';
    },
  },
  {
    site: 'WordPress', domain: 'wordpress.com',
    run: async (email) => {
      const r = await f(`https://public-api.wordpress.com/rest/v1.1/users/${encodeURIComponent(email)}/auth-options?http_envelope=1`,
        { headers: { Accept: 'application/json' } });
      const j = await r.json();
      const body = j?.body;
      if (body && Object.prototype.hasOwnProperty.call(body, 'email_verified')) return 'exists';
      return 'not_found';
    },
  },
  {
    site: 'Replit', domain: 'replit.com',
    run: async (email) => {
      const r = await f('https://replit.com/data/user/exists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://replit.com', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) return 'rateLimit';
      const j = await r.json();
      return j?.exists ? 'exists' : 'not_found';
    },
  },
  {
    site: 'Gravatar', domain: 'gravatar.com',
    run: async (email) => {
      const r = await f(`https://en.gravatar.com/${md5(email.trim().toLowerCase())}.json`);
      if (r.status === 200) return 'exists';
      if (r.status === 404) return 'not_found';
      return 'rateLimit';
    },
  },
  {
    site: 'Docker Hub', domain: 'docker.com',
    run: async (email) => {
      const r = await f('https://hub.docker.com/v2/users/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password: '', recaptcha_response: '', redirect_value: '', subscribe: true, username: '' }),
      });
      const text = await r.text();
      return text.includes('This email is already in use.') ? 'exists' : 'not_found';
    },
  },
  {
    site: 'Patreon', domain: 'patreon.com',
    run: async (email) => {
      const r = await f('https://www.patreon.com/api/email/available', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ data: { attributes: { email }, relationships: {} } }),
      });
      if (!r.ok) return 'rateLimit';
      const j = await r.json();
      const avail = j?.data?.is_available;
      if (avail === true) return 'not_found';
      if (avail === false) return 'exists';
      return 'rateLimit';
    },
  },
  {
    site: 'Issuu', domain: 'issuu.com',
    run: async (email) => {
      const r = await f(`https://issuu.com/call/signup/check-email/${encodeURIComponent(email)}`,
        { headers: { Accept: 'application/json' } });
      if (!r.ok) return 'rateLimit';
      const j = await r.json();
      if (j?.status === 'unavailable') return 'exists';
      if (j?.status === 'available') return 'not_found';
      return 'rateLimit';
    },
  },
  {
    site: 'Duolingo', domain: 'duolingo.com',
    run: async (email) => {
      const r = await f(`https://www.duolingo.com/2017-06-30/users?email=${encodeURIComponent(email)}`,
        { headers: { Accept: 'application/json' } });
      if (!r.ok) return 'rateLimit';
      const j = await r.json();
      return Array.isArray(j?.users) && j.users.length > 0 ? 'exists' : 'not_found';
    },
  },
  {
    site: 'Firefox', domain: 'firefox.com',
    run: async (email) => {
      const r = await f('https://api.accounts.firefox.com/v1/account/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) return 'rateLimit';
      const j = await r.json();
      return j?.exists ? 'exists' : 'not_found';
    },
  },
];

export interface HoleheResult {
  email: string;
  found: CheckResult[];
  results: CheckResult[];
  checked: number;
  total: number;
  rateLimited: number;
  elapsedMs: number;
}

export async function huntEmail(email: string): Promise<HoleheResult> {
  const t0 = Date.now();
  const results = await Promise.all(
    CHECKS.map(async (c): Promise<CheckResult> => {
      const s0 = Date.now();
      try {
        const status = await c.run(email);
        return { site: c.site, domain: c.domain, status, elapsedMs: Date.now() - s0 };
      } catch {
        return { site: c.site, domain: c.domain, status: 'rateLimit', elapsedMs: Date.now() - s0 };
      }
    }),
  );
  const found = results.filter((r) => r.status === 'exists').sort((a, b) => a.site.localeCompare(b.site));
  return {
    email,
    found,
    results,
    checked: results.length,
    total: CHECKS.length,
    rateLimited: results.filter((r) => r.status === 'rateLimit').length,
    elapsedMs: Date.now() - t0,
  };
}

export const emailCheckCount = () => CHECKS.length;
