import type { CctvCamera } from './types';

/**
 * Webcam katmanı — Windy Webcams API v3.
 * Türkiye yoğun (country=TR) + dünya genelinde büyük şehir anchor'ları (nearby).
 * Anahtar: WINDY_API_KEY. 1 saat in-memory cache (liste statik, görüntü server'da güncellenir).
 */

let cache: { at: number; cams: CctvCamera[] } | null = null;
const TTL = 60 * 60 * 1000;

// Anchors removed to prevent 429 Too Many Requests on free tier

async function windy(qs: string, key: string): Promise<any[]> {
  try {
    const res = await fetch(`https://api.windy.com/webcams/api/v3/webcams?${qs}&include=location,images`, {
      headers: { 'x-windy-api-key': key },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.webcams || [];
  } catch {
    return [];
  }
}

function toCam(w: any): CctvCamera | null {
  const loc = w.location || {};
  if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
  const preview = w.images?.current?.preview || w.images?.daylight?.preview || w.images?.current?.thumbnail;
  const id = w.webcamId ?? w.id;
  return {
    id: `windy-${id}`,
    lat: loc.latitude,
    lng: loc.longitude,
    name: w.title || 'Webcam',
    city: loc.city || loc.region || loc.country || '',
    country: loc.country || '',
    feed_url: preview,
    external_url: `https://www.windy.com/webcams/${id}`,
    source: 'Windy',
  };
}

export async function fetchTurkeyCameras(): Promise<CctvCamera[]> {
  const key = process.env.WINDY_API_KEY;
  if (!key) return [];
  if (cache && Date.now() - cache.at < TTL) return cache.cams;

  // Sıralı fetch (429'u önlemek için)
  const byId = new Map<string, CctvCamera>();
  
  for (const offset of [0, 50, 100]) {
    const data = await windy(`countries=TR&limit=50&offset=${offset}`, key);
    for (const w of data) {
      const cam = toCam(w);
      if (cam && !byId.has(cam.id)) byId.set(cam.id, cam);
    }
  }

  const cams = [...byId.values()];
  
  // ── ÖZEL EKLENTİ: ANKARA (ABB) VE İSTANBUL (İBB YOUTUBE) CANLI YAYINLARI ──
  const curatedCams: CctvCamera[] = [
    // Ankara ABB (Karataş Hayvan Bakımevi)
    {
      id: 'ankara-karatas-2', lat: 39.7915, lng: 32.8988,
      name: 'Ankara - Karataş Bakımevi (Kamera 2)', city: 'Ankara', country: 'Türkiye',
      stream_url: 'https://stream.ankara.bel.tr/live/4/index.m3u8', stream_type: 'hls', source: 'ABB Canlı'
    },
    {
      id: 'ankara-karatas-3', lat: 39.7916, lng: 32.8989,
      name: 'Ankara - Karataş Bakımevi (Kamera 3)', city: 'Ankara', country: 'Türkiye',
      stream_url: 'https://stream.ankara.bel.tr/live/5/index.m3u8', stream_type: 'hls', source: 'ABB Canlı'
    },
    {
      id: 'ankara-karatas-4', lat: 39.7917, lng: 32.8987,
      name: 'Ankara - Karataş Bakımevi (Kamera 4)', city: 'Ankara', country: 'Türkiye',
      stream_url: 'https://stream.ankara.bel.tr/live/6/index.m3u8', stream_type: 'hls', source: 'ABB Canlı'
    },
    {
      id: 'ankara-karatas-5', lat: 39.7914, lng: 32.8986,
      name: 'Ankara - Karataş Bakımevi (Kamera 5)', city: 'Ankara', country: 'Türkiye',
      stream_url: 'https://stream.ankara.bel.tr/live/7/index.m3u8', stream_type: 'hls', source: 'ABB Canlı'
    },
    // İstanbul (YouTube Live Streams)
    {
      id: 'ist-istiklal', lat: 41.0337, lng: 28.9775,
      name: 'İstanbul - İstiklal Caddesi (Canlı)', city: 'İstanbul', country: 'Türkiye',
      stream_url: 'https://www.youtube.com/embed/Pj1yWqI2N1A?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live'
    },
    {
      id: 'ist-eminonu', lat: 41.0163, lng: 28.9734,
      name: 'İstanbul - Eminönü (Canlı)', city: 'İstanbul', country: 'Türkiye',
      stream_url: 'https://www.youtube.com/embed/5aI_L-wT1_A?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live'
    },
    {
      id: 'ist-camlica', lat: 41.0264, lng: 29.0682,
      name: 'İstanbul - Çamlıca Tepesi (Canlı)', city: 'İstanbul', country: 'Türkiye',
      stream_url: 'https://www.youtube.com/embed/q1jU6G-T-f4?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live'
    }
  ];
  
  cams.push(...curatedCams);

  if (cams.length) cache = { at: Date.now(), cams };
  return cams;
}

export default [] as CctvCamera[];
