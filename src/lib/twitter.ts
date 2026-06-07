/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — X / Twitter intelligence (X API v2, app-only Bearer)
 *
 *  Reads PUBLIC data only via the official API: profile metadata +
 *  a small number of recent public posts. Pay-per-use is billed per
 *  read, so the timeline pull is intentionally small (default 5) and
 *  capped. Requires X_BEARER_TOKEN in the environment.
 * ═══════════════════════════════════════════════════════════════
 */

const API = 'https://api.x.com/2';

const USER_FIELDS = [
  'created_at', 'description', 'location', 'public_metrics',
  'verified', 'verified_type', 'profile_image_url', 'url', 'protected',
].join(',');

const TWEET_FIELDS = ['created_at', 'public_metrics', 'lang'].join(',');

export interface XProfile {
  id: string;
  username: string;
  name: string;
  description: string | null;
  location: string | null;
  url: string | null;
  verified: boolean;
  verified_type: string | null;
  protected: boolean;
  created_at: string | null;
  profile_image_url: string | null;
  followers: number;
  following: number;
  tweets: number;
  listed: number;
}

export interface XTweet {
  id: string;
  text: string;
  created_at: string | null;
  lang: string | null;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  url: string;
}

export interface XResult {
  username: string;
  profile: XProfile;
  recentTweets: XTweet[];
  elapsedMs: number;
}

export class XError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new XError(503, 'X_BEARER_TOKEN not configured');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function xget(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 401) throw new XError(401, 'Invalid or unauthorized X Bearer token');
  if (res.status === 402 || res.status === 403) throw new XError(402, 'X API request refused — likely insufficient credit balance or access tier');
  if (res.status === 429) throw new XError(429, 'X API rate limit exceeded');
  const json = await res.json();
  if (!res.ok) {
    const detail = json?.detail || json?.title || `HTTP ${res.status}`;
    throw new XError(res.status, detail);
  }
  return json;
}

export interface XSearchTweet {
  id: string; text: string; author: string; created_at: string | null;
  likes: number; retweets: number; replies: number; url: string;
}
export interface XSearchResult { query: string; total: number; tweets: XSearchTweet[]; }

/** General X/Twitter search — recent public tweets matching a query (keyword,
 *  hashtag, from:user, lang:tr, etc). Billed per read on pay-per-use. */
export async function searchX(query: string, max = 12): Promise<XSearchResult> {
  const n = Math.min(Math.max(max, 10), 30);
  const fields = 'created_at,public_metrics,lang';
  const resp = await xget(
    `/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${n}` +
    `&tweet.fields=${fields}&expansions=author_id&user.fields=username,name,verified`,
  );
  const users = new Map<string, any>((resp.includes?.users || []).map((u: any) => [u.id, u]));
  const tweets: XSearchTweet[] = (resp.data || []).map((t: any) => {
    const m = t.public_metrics || {};
    const u = users.get(t.author_id);
    const handle = u?.username || t.author_id;
    return {
      id: t.id,
      text: t.text,
      author: u ? `@${u.username}${u.verified ? ' ✓' : ''}` : t.author_id,
      created_at: t.created_at || null,
      likes: m.like_count ?? 0,
      retweets: m.retweet_count ?? 0,
      replies: m.reply_count ?? 0,
      url: `https://x.com/${handle}/status/${t.id}`,
    };
  });
  return { query, total: tweets.length, tweets };
}

export async function huntX(username: string, opts: { tweets?: number } = {}): Promise<XResult> {
  const t0 = Date.now();
  const handle = username.replace(/^@/, '');
  const tweetCount = Math.min(Math.max(opts.tweets ?? 5, 0), 20);

  const userResp = await xget(`/users/by/username/${encodeURIComponent(handle)}?user.fields=${USER_FIELDS}`);
  if (!userResp.data) throw new XError(404, `User @${handle} not found`);
  const u = userResp.data;
  const m = u.public_metrics || {};

  const profile: XProfile = {
    id: u.id,
    username: u.username,
    name: u.name,
    description: u.description || null,
    location: u.location || null,
    url: u.url || null,
    verified: !!u.verified,
    verified_type: u.verified_type || null,
    protected: !!u.protected,
    created_at: u.created_at || null,
    profile_image_url: (u.profile_image_url || '').replace('_normal', '') || null,
    followers: m.followers_count ?? 0,
    following: m.following_count ?? 0,
    tweets: m.tweet_count ?? 0,
    listed: m.listed_count ?? 0,
  };

  // Recent public posts — skipped for protected accounts or when tweets=0.
  let recentTweets: XTweet[] = [];
  if (tweetCount > 0 && !profile.protected) {
    try {
      const tw = await xget(
        `/users/${u.id}/tweets?max_results=${tweetCount}&tweet.fields=${TWEET_FIELDS}&exclude=retweets,replies`,
      );
      recentTweets = (tw.data || []).map((t: any): XTweet => {
        const tm = t.public_metrics || {};
        return {
          id: t.id,
          text: t.text,
          created_at: t.created_at || null,
          lang: t.lang || null,
          likes: tm.like_count ?? 0,
          retweets: tm.retweet_count ?? 0,
          replies: tm.reply_count ?? 0,
          quotes: tm.quote_count ?? 0,
          url: `https://x.com/${u.username}/status/${t.id}`,
        };
      });
    } catch (e) {
      // Profile already succeeded — don't fail the whole lookup if the
      // timeline call is rate-limited / out of credit.
      if (!(e instanceof XError) || e.status === 401) throw e;
    }
  }

  return { username: handle, profile, recentTweets, elapsedMs: Date.now() - t0 };
}

export const xConfigured = () => !!process.env.X_BEARER_TOKEN;
