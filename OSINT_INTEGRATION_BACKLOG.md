# KUZGU — OSINT Integration Backlog

> **Project renamed OSIRIS → KUZGU** (user-facing brand). Internal env vars
> (`OSIRIS_PORT`, `OSIRIS_KEY`/`SCANNER_*`), the `OsirisMap` component
> identifier, the live domain `osirisai.live`, and a few code identifiers
> (`getOsirisShipType`, `ingestOsirisData`) are intentionally left unchanged
> to avoid breaking config/imports.

Goal: merge the best features of multiple open-source OSINT projects into one
coherent platform. Each repo is analyzed, triaged, and either integrated or
skipped — not blindly copied.

## Integration method legend
- 🟢 **Native TS port** — reimplement in the existing Next.js/TS stack (cleanest)
- 🟡 **Subprocess** — call an external (e.g. Python) tool via child_process (local use)
- 🟠 **Sidecar** — separate service, like the existing `SCANNER_URL` backend
- ⚪ **Data only** — take the manifest / wordlist / IOC feed, not the code
- 🔴 **Skip** — overlaps existing, low value, or license/stack mismatch

## Status legend
`DONE` · `IN PROGRESS` · `PLANNED` · `EVALUATING` · `SKIPPED`

---

## Integrated / Decided

| Repo | Feature | Method | Status |
|------|---------|--------|--------|
| sherlock-project/sherlock | Username enumeration (462 sites) | 🟢 Native TS port | **DONE** — `src/lib/sherlock.ts`, `/api/osint/username`, USERNAME tab. Soft-404 guard, ~96% precision. |
| lissy93/web-check | Consolidated domain report (12 modules) | 🟢 Native TS port | **DONE** — `src/lib/webcheck.ts`, `/api/osint/webcheck`, WEB CHECK tab. SPF/DKIM/DMARC/BIMI, DNSSEC, 10 security headers, HSTS preload, WAF/CDN fingerprint, security.txt, redirect chain (SSRF-validated per hop), Wayback stats, Tranco rank, TXT. Verified on github.com (#28) + cloudflare.com (WAF + DNSSEC). Wayback rate-limits datacenter IPs → graceful skip. |
| soxoj/maigret | 3000+ site DB → expand username engine | ⚪ Data + 🟢 engine ext | **DONE** — `scripts/build-username-manifest.py` merges maigret+sherlock → `src/lib/sherlock-data.json` (462→1409 sites). Engine extended with presenseStrs/absenceStrs body detection. Soft-404 control probe generalized to ALL types → ~99.6% precision (5 FP on random string), torvalds recall ~112 in ~40s. |
| megadose/holehe | Email → registered accounts | 🟢 Native TS port (12 of 123 checks) | **DONE** — `src/lib/holehe.ts`, `/api/osint/email`, EMAIL ACCOUNTS tab. Registry of per-site checks: Spotify, Twitter/X, Imgur, Pinterest, WordPress, Replit, Gravatar, Docker Hub, Patreon, Issuu, Duolingo, Firefox. ~1s. Several rate-limit datacenter IPs (work on residential). Extensible — add more by appending to CHECKS. |

## Triaged batch #1 (21 repos)

### High priority
| Repo | Lang | What it adds | Method |
|------|------|--------------|--------|
| projectdiscovery/subfinder + laramies/theHarvester (subdomain sources) | Go/Py | Passive subdomain enumeration | 🟢 Native TS | **DONE** — `src/lib/subenum.ts`, `/api/osint/subdomains`, PASSIVE SUBS tab. Aggregates crt.sh, hackertarget, rapiddns, certspotter, AlienVault OTX, Wayback; dedupes + resolves live hosts. tesla.com → 202 found / 145 live in ~13s. theHarvester's email-from-search-engine harvesting NOT done (fragile scraping/needs keys) — deferred. |
| lissy93/web-check | Node/TS | 40+ domain checks: DMARC/DKIM/SPF/BIMI, DNSSEC, TLS cipher+grade, HTTP sec headers, redirect chain, archive history, Tranco rank, tech stack, security.txt | 🟢 Native (same stack) |
| megadose/holehe | Python | Email → 120+ sites it's registered on (email sibling of Sherlock) | 🟢 Native port |
| soxoj/maigret | Python | 3000+ site DB (beats our 462) + profile-data extraction | ⚪ Adopt site DB into sherlock.ts engine; 🟡 subprocess for profile data |
| laramies/theHarvester | Python | Domain → emails/subdomains/hosts (search engines, certs, PGP) | 🟡 Subprocess + 🟢 keyless sources |
| sundowndev/phoneinfoga | Go | Phone: carrier, line type, reputation, dork footprint (our phone tab is offline-only) | 🟢 Native TS port | **DONE** — `src/lib/phone-footprint.ts` + enhanced `/api/osint/phone`. Authoritative line-type via libphonenumber `getNumberType`; phoneinfoga keyless Google-dork generator (39 links: general/social/reputation/disposable-SMS). PHONE INTEL tab now shows clickable footprint dorks. Verified +14155552671 → FIXED_LINE_OR_MOBILE + 39 dorks. |
| projectdiscovery/subfinder | Go | Fast passive subdomain enum (dozens of sources) | 🟡 Subprocess / 🟢 source port |

### Medium
| Repo | Lang | What it adds | Method |
|------|------|--------------|--------|
| koala73/worldmonitor | TS/Tauri | Sibling dashboard: Country Risk Index, finance radar (92 exchanges), 500+ feed list, multilang, local Ollama AI | ⚪ feed/score data + 🟢 cherry-pick features |
| s0md3v/Photon | Python | Crawler → extracts emails/social/subdomains/secrets from a site | 🟢 Native TS port | **DONE** — `src/lib/photon.ts`, `/api/osint/crawl`, WEB CRAWLER tab. Same-host bounded BFS crawl (SSRF-guarded) → emails, social profiles, external domains, JS files, IPs, targeted secret patterns (Google/AWS/Slack/Stripe/JWT/private-key). HN 15pp/2.4s → 26 social, 99 ext domains. |
| owasp-amass/amass | Go | Deep subdomain/asset discovery (brute+DNS) | 🟡 Subprocess |
| mxrch/GHunt | Python | Google account OSINT | 🟡 Subprocess | **DONE & WORKING** — `src/lib/ghunt.ts` + `scripts/ghunt_email.py` + `/api/osint/google` + GOOGLE OSINT tab. Returns Gaia ID, names, emails, profile photos, in-app reachability, Maps review stats. Authenticated via `ghunt login` (oauth_token method, creds at `~/.malfrats/ghunt/creds.m`, account efearas06). **Verified live (Gaia 117303624166521943990, 2s).** Two GHunt 2.3.4 bugs (`KeyError 'container'`, `NameError photos/reviews` in --json) bypassed by `scripts/ghunt_email.py` calling GHunt's APIs directly + runtime monkeypatch — NO site-packages edit. Install was `pip --no-deps` (pillow<11 pin has no Py3.14 wheel; reused pillow 12). |
| smicallef/spiderfoot | Python | 200+ module automation engine + correlation (whole platform) | 🟠 Sidecar (later phase) |
| gildas-lormeau/SingleFile | JS | Archive a page as single HTML (evidence capture) | 🟡 CLI | **DONE & WORKING** — `src/lib/archive.ts`, `/api/osint/archive`, WEB ARCHIVE tab. `single-file-cli` (npm -g) drives system Chrome (no chromium download). Saves self-contained .html to `public/archives/` → clickable snapshot link in dashboard. SSRF-guarded. Verified example.com → servable snapshot in 8s. `public/archives/` gitignored. |

### Low / niche
| Repo | Lang | Verdict | Method |
|------|------|---------|--------|
| qeeqbox/social-analyzer | JS/Py | name-permutation idea (rest overlaps maigret) | ⚪ idea | **DONE** — `src/lib/permutations.ts`, `/api/osint/permute`, NAME PERMUTE tab. Name(+nick/year/domain) → username & email permutations; chips pivot into USERNAME/EMAIL tabs. Pure local. Verified "John Smith"→85 usernames/60 emails. |
| instaloader/instaloader | Python | IG profile/post/metadata | 🟡 Subprocess | **DONE** — `scripts/ig_lookup.py` + `/api/osint/instagram` (execFile, no shell) + INSTAGRAM tab. Public profile (followers/following/posts, bio, verified, private, business, external URL, pic) + recent posts (caption/likes/comments). Anonymous works from residential IP; optional `IG_SESSION_USER` for reliability. Verified on @instagram (685M) + @nasa (104M, 4 posts). Note: lucide brand icons (Instagram/Twitter) are removed in this lucide-react version — used Camera/AtSign instead. |
| Datalux/Osintgram | Python | IG OSINT, needs IG login + ToS risk | 🔴 Superseded by instaloader | covered by the instaloader module above |

### Skipped
| Repo | Reason |
|------|--------|
| HunxByts/GhostTrack | IP+phone+username all already in OSIRIS |
| twintproject/twint | Dead since 2023 (Twitter API changes) |
| osintlibrary maigret-telegram-bot | Hosted deployment of maigret, not a repo — use maigret directly |

### Reference / data-only
| Repo | Use |
|------|-----|
| jivoi/awesome-osint | Curated source/tool list — mine for more feeds |
| lockfale/OSINT-Framework | Categorized OSINT resource tree — optional embedded resource browser |

### Twitter/X (official API)
| Source | Method | Status |
|--------|--------|--------|
| X API v2 (app-only Bearer, pay-per-use) | 🟢 Native TS | **DONE** — `src/lib/twitter.ts`, `/api/osint/twitter`, TWITTER/X tab. Public profile metadata (bio, followers/following, joined, verified, location, id) + recent public posts (default 5, capped 20, billed per read). Token in `.env` `X_BEARER_TOKEN`. Returns 503 if unset, 402 if out of credit, 401 if token bad. Verified live on @jack. |

### Separate category (for Claude Code, not OSIRIS app)
| Repo | Use |
|------|-----|
| mukul975/Anthropic-Cybersecurity-Skills | 754 Claude Code security skills (agentskills.io) — install into the user's CC env to assist building/operating OSIRIS |

---

## Proposed phased roadmap
- **Phase 1 (RECON depth, same stack):** web-check modules → biggest win, native TS.
- **Phase 2 (people/email):** holehe (email→accounts) + expand Sherlock with maigret's 3000+ site DB.
- **Phase 3 (domain footprint):** theHarvester emails + subfinder/amass subdomains + Photon crawler.
- **Phase 4 (phone):** phoneinfoga upgrade of the phone tab.
- **Phase 5 (dashboard parity):** worldmonitor's Country Risk Index + finance radar + feed expansion.
- **Phase 6 (heavy/optional):** SpiderFoot sidecar, GHunt, Instagram tools, SingleFile evidence capture.

---

## 🤖 AI Analyst — DeepSeek agent (DONE)
Natural-language → automated investigation. `src/lib/ai-agent.ts` + `/api/ai/agent`
+ `src/components/AiCommand.tsx` (gold sparkle button, bottom-right). DeepSeek **V3
(deepseek-chat)** orchestrates 12 OSINT modules via function calling; **R1
(deepseek-reasoner)** writes the final Turkish report. Tools: web_check, subdomains,
find_email_accounts, google_osint, username_hunt, twitter/instagram/github lookup,
phone_intel, ip_intel, crawl, name_permutations (in-process libs + internal routes,
trimmed outputs). Key in `.env` `DEEPSEEK_API_KEY`. Verified: "John Smith permutations"
(21s, name_permutations) and "github.com güvenlik analizi" (48s, web_check+subdomains →
full Turkish report). Solves the "too many tabs" complexity — one command box.

## 🕸️ Correlation graph — THE MERGE (DONE)
The payoff that ties the 12 modules into one platform. `src/lib/osint-graph.ts`
(`expandNode`) + `/api/osint/graph` chain KUZGU's own modules to return connected
entities; `EntityGraphPanel` extended with OSINT node types (domain/host/ip/email/
username/org/service) + endpoint switch (OSINT types → `/api/osint/graph`, physical
→ intel layer). OsintPanel has a Network-icon **graph pivot button** (`onGraphPivot`)
that roots the graph at the current finding; clicking any node expands it recursively.
Expansions: domain→subdomains→IPs + mail-provider org; ip→ASN org + geo country;
host→ip; email→registered services (holehe) + Google account/Gaia (GHunt).
Verified: github.com→37 nodes/50 links (12s); email→services+person; ip→country.

## Native KUZGU enhancements (DONE)
- **GitHub OSINT upgrade** — `/api/osint/github` rewritten: now mines the
  commit-email leak (author email from the user's own commits across recent
  non-fork repos; events-API method is dead — GitHub empties payload.commits),
  plus public SSH-key count, gists, orgs, following. Optional `GITHUB_TOKEN`
  env lifts 60→5000 req/hr. Added rate-limit (was unguarded). Verified:
  torvalds→torvalds@linux-foundation.org, antirez→antirez@gmail.com.

## Cross-cutting upgrades identified (not from a specific repo)
- Add rate-limit to remaining unguarded routes: `shodan`, `mac`, `leaks` (github now guarded)
- Turn `certs` (crt.sh) into full passive subdomain enumeration
- Add Wayback / archive.org CDX lookup
- Wire OSINT results into the existing entity graph for pivoting
- SSE streaming for long-running tools (username hunt currently blocks ~20s)
