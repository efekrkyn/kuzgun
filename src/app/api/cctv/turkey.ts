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
  
  // ── ÖZEL EKLENTİ: KGYS (Kent Güvenlik Yönetim Sistemi) SİMÜLASYONU ──
  // Gerçekçi bir istihbarat ağı görünümü için tüm Türkiye geneline dağıtılmış güvenli/kriptolu kamera ağları.
  const secureFeedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="224" viewBox="0 0 400 224">
  <rect width="400" height="224" fill="#050505"/>
  <rect width="400" height="224" fill="none" stroke="#39FF14" stroke-width="2" opacity="0.3"/>
  
  <!-- Grid Background -->
  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#39FF14" stroke-width="0.5" opacity="0.1"/>
  </pattern>
  <rect width="400" height="224" fill="url(#grid)" />

  <!-- Target Reticle -->
  <path d="M 200 82 L 200 92 M 200 132 L 200 142 M 170 112 L 180 112 M 220 112 L 230 112" stroke="#39FF14" stroke-width="1.5" opacity="0.6"/>
  <circle cx="200" cy="112" r="20" fill="none" stroke="#39FF14" stroke-width="1" opacity="0.4"/>

  <!-- Texts -->
  <text x="200" y="80" font-family="monospace" font-size="14" font-weight="bold" fill="#39FF14" text-anchor="middle" letter-spacing="2">KGYS NODE ACTIVE</text>
  <text x="200" y="150" font-family="monospace" font-size="10" fill="#39FF14" text-anchor="middle" opacity="0.7">E2E ENCRYPTED VIDEO STREAM</text>
  <text x="200" y="170" font-family="monospace" font-size="9" fill="#FF3D3D" text-anchor="middle" letter-spacing="1" opacity="0.9">KUZGUN OMNI-CLEARANCE REQUIRED</text>
  
  <!-- REC Indicator -->
  <rect x="15" y="15" width="45" height="18" fill="none" stroke="#FF3D3D" stroke-width="1"/>
  <text x="38" y="27" font-family="monospace" font-size="10" fill="#FF3D3D" font-weight="bold">REC</text>
  <circle cx="24" cy="24" r="4" fill="#FF3D3D">
    <animate attributeName="opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite"/>
  </circle>

  <!-- Scanning Line -->
  <line x1="0" y1="0" x2="400" y2="0" stroke="#39FF14" stroke-width="2" opacity="0.5">
    <animate attributeName="y1" values="0;224;0" dur="4s" repeatCount="indefinite" />
    <animate attributeName="y2" values="0;224;0" dur="4s" repeatCount="indefinite" />
  </line>
</svg>`.trim();
  const feedDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(secureFeedSvg);

  const curatedCams: CctvCamera[] = [
    // Ankara ABB (Karataş Hayvan Bakımevi) - Canlı HLS yayını çalışıyor
    { id: 'ankara-karatas-2', lat: 39.7915, lng: 32.8988, name: 'Ankara - Karataş Bakımevi (Kamera 2)', city: 'Ankara', country: 'Türkiye', stream_url: 'https://stream.ankara.bel.tr/live/4/index.m3u8', stream_type: 'hls', source: 'ABB Canlı' },
    { id: 'ankara-karatas-3', lat: 39.7916, lng: 32.8989, name: 'Ankara - Karataş Bakımevi (Kamera 3)', city: 'Ankara', country: 'Türkiye', stream_url: 'https://stream.ankara.bel.tr/live/5/index.m3u8', stream_type: 'hls', source: 'ABB Canlı' },
    { id: 'ankara-karatas-4', lat: 39.7917, lng: 32.8987, name: 'Ankara - Karataş Bakımevi (Kamera 4)', city: 'Ankara', country: 'Türkiye', stream_url: 'https://stream.ankara.bel.tr/live/6/index.m3u8', stream_type: 'hls', source: 'ABB Canlı' },
  ];

  // Ana şehirlerin koordinatları ve eklenecek kamera sayıları
  const cities = [
    { name: 'İstanbul', lat: 41.0082, lng: 28.9784, count: 65, radius: 0.25 },
    { name: 'Ankara', lat: 39.9334, lng: 32.8597, count: 40, radius: 0.15 },
    { name: 'İzmir', lat: 38.4237, lng: 27.1428, count: 35, radius: 0.15 },
    { name: 'Antalya', lat: 36.8969, lng: 30.7133, count: 25, radius: 0.12 },
    { name: 'Bursa', lat: 40.1828, lng: 29.0667, count: 20, radius: 0.1 },
    { name: 'Adana', lat: 37.0000, lng: 35.3213, count: 15, radius: 0.08 },
    { name: 'Gaziantep', lat: 37.0662, lng: 37.3833, count: 15, radius: 0.08 },
    { name: 'Konya', lat: 37.8746, lng: 32.4932, count: 15, radius: 0.1 },
    { name: 'Diyarbakır', lat: 37.9100, lng: 40.2400, count: 12, radius: 0.08 },
    { name: 'Mersin', lat: 36.8121, lng: 34.6415, count: 12, radius: 0.08 },
    { name: 'Kayseri', lat: 38.7348, lng: 35.4679, count: 12, radius: 0.08 },
    { name: 'Eskişehir', lat: 39.7667, lng: 30.5256, count: 10, radius: 0.06 },
    { name: 'Trabzon', lat: 41.0050, lng: 39.7269, count: 10, radius: 0.05 },
    { name: 'Samsun', lat: 41.2867, lng: 36.3300, count: 10, radius: 0.06 },
    { name: 'Erzurum', lat: 39.9043, lng: 41.2679, count: 8, radius: 0.05 },
    { name: 'Van', lat: 38.5012, lng: 43.3730, count: 8, radius: 0.05 },
    { name: 'Şanlıurfa', lat: 37.1671, lng: 38.7939, count: 8, radius: 0.05 },
    { name: 'Muğla', lat: 37.2153, lng: 28.3636, count: 15, radius: 0.2 }, // Turistik geniş alan
    { name: 'Hatay', lat: 36.2066, lng: 36.1572, count: 8, radius: 0.05 },
    { name: 'Çanakkale', lat: 40.1553, lng: 26.4082, count: 8, radius: 0.05 },
  ];

  let simId = 1;
  for (const city of cities) {
    for (let i = 0; i < city.count; i++) {
      // Rastgele dağılım
      const latOffset = (Math.random() - 0.5) * city.radius;
      const lngOffset = (Math.random() - 0.5) * city.radius;
      curatedCams.push({
        id: `kgys-sim-${simId++}`,
        lat: city.lat + latOffset,
        lng: city.lng + lngOffset,
        name: `${city.name} - KGYS Düğümü #${Math.floor(Math.random() * 9000) + 1000}`,
        city: city.name,
        country: 'Türkiye',
        feed_url: feedDataUrl,
        source: 'KGYS Kriptolu Ağ',
      });
    }
  }
  
  cams.push(...curatedCams);

  if (cams.length) cache = { at: Date.now(), cams };
  return cams;
}

export default [] as CctvCamera[];
