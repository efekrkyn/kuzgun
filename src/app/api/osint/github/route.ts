import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

// GitHub OSINT — profile + the classic commit-email leak (push-event author
// emails), public SSH keys, gists, and orgs. Set GITHUB_TOKEN in .env to lift
// the 60 req/hr unauthenticated limit to 5000/hr.
export const dynamic = 'force-dynamic';

function gh(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': 'KUZGU-Recon',
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(10_000) });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get('user') || '').trim().replace(/^@/, '');
  if (!username) return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 });
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid GitHub username' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 15, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const u = encodeURIComponent(username);
    const [userRes, reposRes, gistsRes, orgsRes, keysRes] = await Promise.all([
      gh(`/users/${u}`),
      gh(`/users/${u}/repos?sort=pushed&per_page=10`),
      gh(`/users/${u}/gists?per_page=10`),
      gh(`/users/${u}/orgs`),
      fetch(`https://github.com/${u}.keys`, { headers: { 'User-Agent': 'KUZGU-Recon' }, signal: AbortSignal.timeout(8000) }),
    ]);

    if (userRes.status === 404) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!userRes.ok) throw new Error(`GitHub API HTTP ${userRes.status}`);

    const userData = await userRes.json();
    const reposData = reposRes.ok ? await reposRes.json() : [];
    const gistsData = gistsRes.ok ? await gistsRes.json() : [];
    const orgsData = orgsRes.ok ? await orgsRes.json() : [];

    // ── Commit-email leak ──────────────────────────────────────────
    // The git commit objects expose the email a user commits with (unless
    // they enabled "keep my email private"). Mine the author's own commits
    // across their most recently pushed non-fork repos.
    const emailMap = new Map<string, Set<string>>(); // email -> names seen
    const ownRepos = (Array.isArray(reposData) ? reposData : [])
      .filter((r: any) => !r.fork)
      .slice(0, 6);
    const commitResults = await Promise.allSettled(
      ownRepos.map((r: any) =>
        gh(`/repos/${encodeURIComponent(userData.login)}/${encodeURIComponent(r.name)}/commits?author=${u}&per_page=5`)
          .then((res) => (res.ok ? res.json() : [])),
      ),
    );
    for (const cr of commitResults) {
      if (cr.status !== 'fulfilled' || !Array.isArray(cr.value)) continue;
      for (const c of cr.value) {
        const a = c?.commit?.author || {};
        const email: string | undefined = a.email;
        const name: string | undefined = a.name;
        if (!email || email.endsWith('users.noreply.github.com')) continue;
        if (!emailMap.has(email)) emailMap.set(email, new Set());
        if (name) emailMap.get(email)!.add(name);
      }
    }
    const leakedEmails = [...emailMap.entries()].map(([email, names]) => ({ email, names: [...names] }));

    // public SSH key fingerprints (presence + count)
    let sshKeys = 0;
    if (keysRes.ok) {
      const txt = await keysRes.text();
      sshKeys = txt.split('\n').filter((l) => l.trim().startsWith('ssh-')).length;
    }

    return NextResponse.json({
      username: userData.login,
      name: userData.name,
      company: userData.company,
      blog: userData.blog,
      location: userData.location,
      email: userData.email,
      bio: userData.bio,
      twitter: userData.twitter_username,
      public_repos: userData.public_repos,
      followers: userData.followers,
      following: userData.following,
      created_at: userData.created_at,
      avatar_url: userData.avatar_url,
      hireable: userData.hireable,
      leaked_emails: leakedEmails,
      ssh_keys: sshKeys,
      orgs: Array.isArray(orgsData) ? orgsData.map((o: any) => o.login) : [],
      gists: Array.isArray(gistsData)
        ? gistsData.slice(0, 10).map((g: any) => ({
            description: g.description || '(no description)',
            files: Object.keys(g.files || {}).join(', '),
            url: g.html_url,
          }))
        : [],
      recent_repos: Array.isArray(reposData)
        ? reposData.map((r: any) => ({ name: r.name, language: r.language, stars: r.stargazers_count, updated: r.pushed_at, fork: r.fork }))
        : [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'GitHub lookup failed', detail: error.message }, { status: 502 });
  }
}
