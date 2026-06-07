/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — OSINT correlation brain (entity-graph expansion)
 *
 *  Given a node (domain / host / ip / email / username), returns the
 *  connected entities by calling KUZGU's own OSINT modules directly.
 *  This is what turns the separate tools into one pivotable graph:
 *
 *    domain ─subdomain→ host ─resolves→ ip ─ASN→ org / ─geo→ country
 *    domain ─mail→ org(provider)
 *    email  ─registered→ service(s) / ─google→ person(gaia)
 *
 *  Node ids are `${type}:${value}` so the panel can dedupe + merge as
 *  the user expands. Each source is best-effort (failures are skipped).
 * ═══════════════════════════════════════════════════════════════
 */

import dns from 'node:dns/promises';
import { enumerateSubdomains } from './subenum';
import { huntEmail } from './holehe';
import { huntGoogle } from './ghunt';
import { huntUsername } from './sherlock';

export interface GNode { id: string; label: string; type: string; properties?: Record<string, unknown>; }
export interface GLink { source: string; target: string; label: string; }
export interface Graph { nodes: GNode[]; links: GLink[]; }

const nid = (type: string, val: string) => `${type}:${val}`;

const MAIL_PROVIDERS: Array<[RegExp, string]> = [
  [/google|gmail/i, 'Google Workspace'],
  [/outlook|microsoft|office365/i, 'Microsoft 365'],
  [/proton/i, 'ProtonMail'],
  [/zoho/i, 'Zoho'],
  [/yahoodns/i, 'Yahoo'],
  [/mimecast/i, 'Mimecast'],
  [/pphosted|proofpoint/i, 'Proofpoint'],
  [/mailgun/i, 'Mailgun'],
  [/sendgrid/i, 'SendGrid'],
];

function mailProvider(exchange: string): string {
  const hit = MAIL_PROVIDERS.find(([re]) => re.test(exchange));
  return hit ? hit[1] : exchange.replace(/\.$/, '');
}

export async function expandNode(type: string, id: string, origin: string = 'http://127.0.0.1:3000'): Promise<Graph> {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const seen = new Set<string>();
  const add = (n: GNode) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };
  const link = (s: string, t: string, label: string) => links.push({ source: s, target: t, label });
  const self = nid(type, id);

  if (type === 'domain') {
    // A records → ip nodes
    try {
      const a = await dns.resolve4(id);
      for (const ip of a.slice(0, 4)) {
        add({ id: nid('ip', ip), label: ip, type: 'ip' });
        link(self, nid('ip', ip), 'A');
      }
    } catch { /* skip */ }

    // MX → mail provider org
    try {
      const mx = await dns.resolveMx(id);
      if (mx.length) {
        const provider = mailProvider(mx[0].exchange);
        add({ id: nid('org', provider), label: provider, type: 'org', properties: { kind: 'mail provider' } });
        link(self, nid('org', provider), 'mail');
      }
    } catch { /* skip */ }

    // Passive subdomains → host nodes (+ their resolved ip)
    try {
      const sub = await enumerateSubdomains(id, { resolve: true, resolveCap: 60 });
      const top = sub.subdomains.filter((s) => s.host !== id).slice(0, 25);
      for (const s of top) {
        add({ id: nid('host', s.host), label: s.host.replace(`.${id}`, ''), type: 'host', properties: { fqdn: s.host, alive: s.alive } });
        link(self, nid('host', s.host), 'subdomain');
        if (s.ip) {
          add({ id: nid('ip', s.ip), label: s.ip, type: 'ip' });
          link(nid('host', s.host), nid('ip', s.ip), 'resolves');
        }
      }
    } catch { /* skip */ }
  }

  else if (type === 'host') {
    try {
      const a = await dns.resolve4(id);
      for (const ip of a.slice(0, 4)) {
        add({ id: nid('ip', ip), label: ip, type: 'ip' });
        link(self, nid('ip', ip), 'resolves');
      }
    } catch { /* skip */ }
  }

  else if (type === 'ip') {
    // ASN / owner via bgpview
    try {
      const r = await fetch(`https://api.bgpview.io/ip/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      const pref = d?.data?.prefixes?.[0];
      if (pref?.asn) {
        const owner = pref.asn.description || pref.asn.name || `AS${pref.asn.asn}`;
        add({ id: nid('org', owner), label: owner, type: 'org', properties: { asn: `AS${pref.asn.asn}` } });
        link(self, nid('org', owner), `AS${pref.asn.asn}`);
      }
    } catch { /* skip */ }
    // Geo country
    try {
      const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(id)}?fields=status,country,countryCode`, { signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      if (d?.status === 'success' && d.countryCode) {
        add({ id: nid('country', d.countryCode), label: d.country, type: 'country' });
        link(self, nid('country', d.countryCode), 'geo');
      }
    } catch { /* skip */ }
  }

  else if (type === 'email') {
    // holehe → registered services
    try {
      const h = await huntEmail(id);
      for (const f of h.found) {
        add({ id: nid('service', f.site), label: f.site, type: 'service', properties: { domain: f.domain } });
        link(self, nid('service', f.site), 'registered');
      }
    } catch { /* skip */ }
    // GHunt → Google account (person)
    try {
      const g = await huntGoogle(id);
      const prof = (g.data as any)?.PROFILE_CONTAINER?.profile;
      if (prof?.personId) {
        const name = (prof.names && Object.values(prof.names)[0] && (Object.values(prof.names)[0] as any).fullname) || `Gaia ${prof.personId}`;
        add({ id: nid('person', prof.personId), label: name || `Gaia ${prof.personId}`, type: 'person', properties: { gaia: prof.personId } });
        link(self, nid('person', prof.personId), 'google');
      }
    } catch { /* skip (unauthed / not found) */ }
  }

  else if (type === 'telegram') {
    // KUZGU Telegram API -> extract wallets, links
    try {
      const url = new URL(`${origin}/api/osint/telegram`);
      url.searchParams.set('target', id);
      const r = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
      const d = await r.json();
      if (!d.error) {
        if (d.extracted_links) {
          for (const l of d.extracted_links) {
            const ch = l.split('/').pop() || l;
            add({ id: nid('telegram', ch), label: ch, type: 'telegram' });
            link(self, nid('telegram', ch), 'bağlantılı_kanal');
          }
        }
        if (d.extracted_wallets) {
          for (const w of d.extracted_wallets) {
            add({ id: nid('crypto', w), label: w, type: 'crypto', properties: { wallet: w } });
            link(self, nid('crypto', w), 'cüzdan');
          }
        }
      }
    } catch { /* skip */ }
  }

  else if (type === 'username') {
    // Bounded hunt (graph must stay responsive) → found profiles as service nodes
    try {
      const r = await huntUsername(id, { deadlineMs: 20_000, concurrency: 100 });
      for (const f of r.found.slice(0, 30)) {
        const sid = nid('service', f.site);
        add({ id: sid, label: f.site, type: 'service', properties: { url: f.url } });
        link(self, sid, 'profil');
      }
    } catch { /* skip */ }
  }

  // org / service / person / country → leaf for now
  return { nodes, links };
}
