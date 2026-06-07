/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — AI OSINT Agent (DeepSeek)
 *
 *  Natural-language → automated investigation. DeepSeek V3
 *  (deepseek-chat) orchestrates KUZGU's OSINT modules via function
 *  calling; DeepSeek R1 (deepseek-reasoner) writes the final report.
 *
 *  The model decides which tools to run for the user's request, the
 *  backend executes them (in-process libs + internal routes), and the
 *  collected findings are synthesized into one intelligence brief.
 * ═══════════════════════════════════════════════════════════════
 */

import { runWebCheck } from './webcheck';
import { enumerateSubdomains } from './subenum';
import { huntEmail } from './holehe';
import { huntGoogle } from './ghunt';
import { huntUsername } from './sherlock';
import { huntX, searchX } from './twitter';
import { searchNews, searchWeb } from './news-web';
import { crawlSite } from './photon';
import { generatePermutations } from './permutations';

const API = 'https://api.deepseek.com/chat/completions';
const ORCH_MODEL = 'deepseek-chat';      // V3 — supports function calling
const REPORT_MODEL = 'deepseek-reasoner'; // R1 — reasoning/synthesis

export interface AgentStep { tool: string; args: Record<string, unknown>; summary: string; }
export interface AgentResult { report: string; steps: AgentStep[]; mapCommands?: any[]; model: string; }

export class AgentError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

// ── tool definitions exposed to the model ───────────────────────────
const TOOLS = [
  ['web_check', 'Full domain security/intel report: SPF/DKIM/DMARC, DNSSEC, security headers, WAF, Wayback, Tranco rank. Input: a domain.', { domain: 'string' }],
  ['subdomains', 'Passive subdomain enumeration for a domain (live hosts + IPs).', { domain: 'string' }],
  ['find_email_accounts', 'Check which online services an email is registered on (holehe).', { email: 'string' }],
  ['google_osint', 'Resolve a Google account from an email: Gaia ID, name, photo, Maps (GHunt).', { email: 'string' }],
  ['username_hunt', 'Search a username across 1400+ sites. SLOW (~60-90s) — only when the request is specifically about a username.', { username: 'string' }],
  ['twitter_lookup', 'X/Twitter profile + recent posts for a specific handle.', { handle: 'string' }],
  ['twitter_search', 'Search X/Twitter for recent public tweets by topic/keyword/hashtag (general scan, not a single account). Supports operators like from:user, lang:tr, -is:retweet. Use this when the user wants to monitor a TOPIC on Twitter.', { query: 'string' }],
  ['instagram_lookup', 'Instagram public profile + recent posts for a username.', { username: 'string' }],
  ['github_recon', 'GitHub profile + leaked commit emails + orgs/gists for a username.', { username: 'string' }],
  ['phone_intel', 'Phone number intel: country, carrier, line type + OSINT footprint dorks. Input: E.164 like +14155552671.', { number: 'string' }],
  ['ip_intel', 'IP geolocation, ASN/ISP, reputation.', { ip: 'string' }],
  ['crawl', 'Crawl a website and extract emails, social profiles, external links, secrets. Input: a URL.', { url: 'string' }],
  ['name_permutations', 'Generate likely usernames & emails from a real full name.', { name: 'string' }],
  ['news_search', 'Search global NEWS articles by keyword/topic (GDELT, last few days). Use for current events / "haberlerde ne var" / what is happening about X.', { query: 'string' }],
  ['telegram_search', 'Search recent Telegram OSINT feeds for keywords. Use to find military movements, OSINT reports, and frontline updates.', { query: 'string' }],
  ['web_search', 'Search the general INTERNET (Brave) for a query and get top result links + snippets. Use to answer factual/current questions or find pages.', { query: 'string' }],
  ['map_control', 'Control the 3D map UI. Can toggle specific layers ON/OFF or fly to coordinates. For layers, provide comma-separated names. Valid layers: maritime, flights, military_flights, cctv, earthquakes, fires, weather, infrastructure, live_news, telegram_osint, conflict_zones, balloons. Use this to ACTUALLY SHOW things to the user on their screen.', { action: 'string', lat: 'number?', lng: 'number?', zoom: 'number?', enable_layers: 'string?', disable_layers: 'string?' }],
] as const;

function toolSchema() {
  return TOOLS.map(([name, description, props]) => {
    const requiredKeys: string[] = [];
    const properties: any = {};
    for (const [k, t] of Object.entries(props)) {
      if (t.endsWith('?')) {
        properties[k] = { type: t.replace('?', '') };
      } else {
        properties[k] = { type: t };
        requiredKeys.push(k);
      }
    }
    return {
      type: 'function',
      function: {
        name,
        description,
        parameters: {
          type: 'object',
          properties,
          required: requiredKeys,
        },
      },
    };
  });
}

// ── tool execution (trimmed outputs to stay token-light) ────────────
async function execTool(name: string, args: any, origin: string): Promise<unknown> {
  const get = async (path: string) => {
    const r = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(90_000) });
    return r.json();
  };
  switch (name) {
    case 'web_check': {
      const r = await runWebCheck(args.domain);
      return { hostname: r.hostname, mailConfig: r.mailConfig, dnssec: r.dnssec, httpSecurity: r.httpSecurity, hsts: r.hsts, firewall: r.firewall, securityTxt: r.securityTxt, rank: r.rank, archives: r.archives };
    }
    case 'subdomains': {
      const r = await enumerateSubdomains(args.domain, { resolve: true, resolveCap: 200 });
      return { total: r.total, alive: r.alive, sources: r.sources, hosts: r.subdomains.slice(0, 40).map((s) => ({ host: s.host, ip: s.ip })) };
    }
    case 'find_email_accounts': {
      const r = await huntEmail(args.email);
      return { found: r.found.map((f) => f.site), checked: r.checked, rateLimited: r.rateLimited };
    }
    case 'google_osint': {
      const r = await huntGoogle(args.email);
      const p = (r.data as any)?.PROFILE_CONTAINER?.profile;
      return p ? { gaiaId: p.personId, names: p.names, emails: p.emails && Object.keys(p.emails) } : { found: false };
    }
    case 'username_hunt': {
      // Bounded for the agent so a single call can't run for ~90s.
      const r = await huntUsername(args.username, { deadlineMs: 25_000, concurrency: 100 });
      return { found: r.found.map((f) => ({ site: f.site, url: f.url })), checked: r.checked, total: r.total, truncated: r.truncated };
    }
    case 'twitter_lookup': {
      const r = await huntX(args.handle, { tweets: 5 });
      return { profile: r.profile, recentTweets: r.recentTweets.map((t) => t.text) };
    }
    case 'twitter_search': {
      const r = await searchX(args.query, 15);
      return { query: r.query, tweets: r.tweets.map((t) => ({ author: t.author, text: t.text, likes: t.likes, retweets: t.retweets, url: t.url })) };
    }
    case 'instagram_lookup':
      return get(`/api/osint/instagram?username=${encodeURIComponent(args.username)}&posts=4`);
    case 'github_recon':
      return get(`/api/osint/github?user=${encodeURIComponent(args.username)}`);
    case 'phone_intel': {
      const r: any = await get(`/api/osint/phone?number=${encodeURIComponent(args.number)}`);
      return { valid: r.valid, region: r.region, line_type: r.line_type, number: r.number };
    }
    case 'ip_intel':
      return get(`/api/osint/ip?ip=${encodeURIComponent(args.ip)}`);
    case 'crawl': {
      const r = await crawlSite(args.url, { maxPages: 15 });
      return { emails: r.emails, social: r.social.slice(0, 20), secrets: r.secrets, externalDomains: r.externalLinks.slice(0, 20) };
    }
    case 'name_permutations':
      return generatePermutations({ name: args.name });
    case 'news_search':
      return searchNews(args.query, { max: 15 });
    case 'telegram_search':
      const tRes = await get('/api/telegram-feed');
      const feeds = tRes.telegram_feeds || [];
      const q = (args.query || '').toLowerCase();
      const filtered = q ? feeds.filter((f: any) => f.title.toLowerCase().includes(q) || f.source.toLowerCase().includes(q)) : feeds;
      return filtered.slice(0, 15).map((f: any) => ({ title: f.title, source: f.source, published: f.published }));
    case 'web_search':
      return searchWeb(args.query, 8);
    case 'map_control':
      // The backend just acknowledges the intent; the frontend will execute the actual map commands
      return { success: true, action: args.action, executed_in_ui: true };
    default:
      return { error: `unknown tool ${name}` };
  }
}

async function callDeepseek(body: Record<string, unknown>): Promise<any> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new AgentError(503, 'DEEPSEEK_API_KEY not configured');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 401) throw new AgentError(401, 'Invalid DeepSeek API key');
  if (res.status === 402) throw new AgentError(402, 'DeepSeek: insufficient balance');
  if (!res.ok) throw new AgentError(res.status, `DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const SYSTEM = `You are KUZGU, an OSINT analyst assistant. The user gives a target or question in natural language. Decide which tools to call to investigate, then write a clear intelligence report IN TURKISH.

Rules:
- Pick tools by input type: domain → web_check/subdomains; email → find_email_accounts/google_osint; a single specific username/handle → username_hunt; handle → twitter_lookup/instagram_lookup; a real person's NAME (e.g. "efe karakoyun", "John Smith") → name_permutations; IP → ip_intel; phone → phone_intel; URL → crawl; GitHub user → github_recon.
- For a person's full NAME, use name_permutations — do NOT run username_hunt on a name.
- username_hunt is slow even when bounded; call it AT MOST ONCE, only for a clear single username (no spaces).
- Be efficient: use roughly 3-5 tools TOTAL. Do NOT probe every permutation across every platform — pick the 1-2 most likely candidates only.
- To monitor a TOPIC / keyword / hashtag on Twitter (not one account), use twitter_search (e.g. twitter_search "deprem lang:tr -is:retweet").
- For current events / news, use news_search. For general factual/web questions or to find pages, use web_search. When the user asks "what's happening / haberlerde ne var", combine news_search + twitter_search.
- You are CONVERSATIONAL: this may be a multi-turn chat. Use earlier messages as context for follow-ups ("peki ya onun...", "bir de şunu ara"). If the user just chats or asks a follow-up that needs no tools, answer directly and briefly WITHOUT running tools.
- Never invent data. Base the report only on tool results.
- Keep the final report concise, structured (headers/bullets), and highlight the most important findings + suggested next pivots.`;

export interface ChatTurn { role: 'user' | 'assistant'; content: string; }

export async function runAgent(query: string, origin: string, history: ChatTurn[] = []): Promise<AgentResult> {
  // Seed with system + prior conversation (last ~8 turns) + new query → multi-turn chat
  const priors = history.slice(-8).map((h) => ({ role: h.role, content: h.content }));
  const messages: any[] = [
    { role: 'system', content: SYSTEM },
    ...priors,
    { role: 'user', content: query },
  ];
  const steps: AgentStep[] = [];
  const mapCommands: any[] = [];
  const findingsFull: string[] = []; // fuller tool outputs for the R1 report

  // ── V3 tool-orchestration loop ──
  const MAX_TOOLS = 6; // hard cap so a single request stays fast
  for (let i = 0; i < 4; i++) {
    const data = await callDeepseek({ model: ORCH_MODEL, messages, tools: toolSchema(), tool_choice: 'auto', temperature: 0.2 });
    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg);
    const calls = msg.tool_calls;
    if (!calls || calls.length === 0) break;

    // Execute this turn's tool calls IN PARALLEL (big speedup vs sequential).
    const results = await Promise.all(calls.map(async (call: any) => {
      let args: any = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* ignore */ }
      let result: unknown;
      try { result = await execTool(call.function.name, args, origin); }
      catch (e) { result = { error: e instanceof Error ? e.message : String(e) }; }
      return { call, args, result };
    }));
    for (const { call, args, result } of results) {
      if (call.function.name === 'map_control') mapCommands.push(args);
      const json = JSON.stringify(result);
      steps.push({ tool: call.function.name, args, summary: json.slice(0, 200) });
      findingsFull.push(`### ${call.function.name}(${JSON.stringify(args)})\n${json.slice(0, 4000)}`);
      messages.push({ role: 'tool', tool_call_id: call.id, content: json.slice(0, 6000) });
    }

    if (steps.length >= MAX_TOOLS) break; // enough — go synthesize
  }

  // ── R1 synthesis (final report) ──
  const lastV3 = messages.filter((m) => m.role === 'assistant' && m.content).pop()?.content || '';

  // Conversational fast path: no tools were run (e.g. a follow-up question or
  // chit-chat) → return V3's direct answer, skip the heavy R1 report.
  if (steps.length === 0) {
    return { report: lastV3 || 'Anlamadım, biraz daha açar mısın?', steps, mapCommands, model: ORCH_MODEL };
  }

  try {
    const findings = findingsFull.join('\n\n');
    const r1 = await callDeepseek({
      model: REPORT_MODEL,
      messages: [
        { role: 'system', content: 'You are KUZGU, an expert OSINT analyst. Write a DETAILED, well-structured intelligence report IN TURKISH from the findings. Use markdown headers, tables and bullets.\n\nFor EACH significant finding, do not just state it — EXPLAIN it: (a) what it is, (b) what it means / why it matters, (c) the security or privacy implication or risk. Add relevant context so a reader understands the significance, not just the raw value. Be thorough and educational, but never invent anything beyond the tool findings.\n\nStructure: an overview, then detailed sections per data type, then a "## ⚠️ Riskler & Bulgular" section explaining the key risks, then "## 🎯 Önerilen Sonraki Adımlar" (next pivots with reasoning).\n\nIMPORTANT: End with "## 🧠 Kısa Özet (Sade Dil)" — 2-4 sentences in plain, everyday Turkish that a non-technical person fully understands (no jargon): what this target is, the most important finding, and the main risk.' },
        { role: 'user', content: `User request: ${query}\n\nTool findings:\n${findings || '(no tools were run)'}\n\nDraft so far:\n${lastV3}` },
      ],
      temperature: 0.3,
    });
    const report = r1.choices?.[0]?.message?.content;
    if (report) return { report, steps, mapCommands, model: `${ORCH_MODEL} + ${REPORT_MODEL}` };
  } catch { /* fall back to V3 answer */ }

  return { report: lastV3 || 'No report produced.', steps, mapCommands, model: ORCH_MODEL };
}
