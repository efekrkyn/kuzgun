import { NextResponse } from 'next/server';
import { searchX } from '@/lib/twitter';
import { execFile } from 'node:child_process';
import { join } from 'node:path';

const IG_SCRIPT = join(process.cwd(), 'scripts', 'ig_lookup.py');

function runIgLookup(username: string, posts: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(
      'python3',
      [IG_SCRIPT, username, String(posts)],
      { timeout: 45_000, maxBuffer: 1024 * 1024, env: process.env },
      (err, stdout) => {
        resolve({ code: err ? 1 : 0, out: (stdout || '').trim() });
      },
    );
  });
}

function seededJitter(id: string, amp = 0.02): [number, number] {
  let h = 7;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [((h % 1000) / 1000 - 0.5) * amp, (((h >> 10) % 1000) / 1000 - 0.5) * amp];
}

// Simple Geocoder based on text matching
const ANKARA_COORDS: Record<string, [number, number]> = {
  'kızılay': [39.9208, 32.8541], 'ulus': [39.9417, 32.8544], 'çankaya': [39.8710, 32.8644], 
  'keçiören': [39.9833, 32.8667], 'yenimahalle': [39.9610, 32.7972], 'mamak': [39.9431, 32.9234], 
  'etimesgut': [39.9453, 32.6734], 'sincan': [39.9614, 32.5769], 'gölbaşı': [39.7891, 32.8058],
  'eskişehir yolu': [39.9077, 32.7566], 'konya yolu': [39.8977, 32.8166], 'odtü': [39.8914, 32.7847],
  'bilkent': [39.8687, 32.7487], 'hacettepe': [39.8672, 32.7347], 'tunali': [39.9022, 32.8601],
};

function geocodeText(text: string, id: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(ANKARA_COORDS)) {
    if (lower.includes(key)) {
      const [jitterLat, jitterLng] = seededJitter(id, 0.02);
      return [coords[0] + jitterLat, coords[1] + jitterLng];
    }
  }
  const [jLat, jLng] = seededJitter(id, 0.05);
  return [39.933 + jLat, 32.859 + jLng]; 
}

let cache: { at: number; data: any } | null = null;
const TTL = 180_000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.data);

  const items: any[] = [];

  // 1. Fetch from X (Twitter)
  try {
    const xRes = await searchX('from:AnkaraTrafik OR from:AnkaraHaber OR from:AnkaraBld OR from:mansuryavas06 OR from:ankara_cevirme', 50);
    for (const t of xRes.tweets) {
      const coords = geocodeText(t.text, t.id) || [39.933, 32.859]; // default Ankara
      items.push({
        id: t.id,
        source: 'X / Twitter',
        author: t.author,
        text: t.text,
        url: t.url,
        lat: coords[0],
        lng: coords[1],
        time: t.created_at,
        platform: 'twitter'
      });
    }
  } catch (e) {
    console.warn('Ankara Social X fetch failed', e);
  }

  // 2. Fetch from Instagram (Ankara Trafik)
  try {
    const { out } = await runIgLookup('ankaratrafik', 5);
    if (out) {
      const igData = JSON.parse(out);
      if (igData.recent_posts) {
        for (const p of igData.recent_posts) {
          const coords = geocodeText(p.caption || '', p.shortcode) || [39.933, 32.859];
          items.push({
            id: p.shortcode,
            source: 'Instagram',
            author: '@ankaratrafik',
            text: p.caption ? p.caption.substring(0, 150) + '...' : 'Instagram Post',
            url: p.url,
            lat: coords[0],
            lng: coords[1],
            time: p.date,
            platform: 'instagram'
          });
        }
      }
    }
  } catch (e) {
    console.warn('Ankara Social IG fetch failed', e);
  }

  const payload = { feeds: items };
  cache = { at: Date.now(), data: payload };
  return NextResponse.json(payload);
}
