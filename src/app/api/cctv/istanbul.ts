import type { CctvCamera } from './types';

/**
 * İstanbul trafik kameraları — İBB UYM (tkmservices.ibb.gov.tr).
 * ~1600 kamera, canlı snapshot (CameraImage.ashx). Anahtarsız, public.
 * Koordinat: XCoord=boylam(lng), YCoord=enlem(lat). 5 dk in-memory cache.
 */

let cache: { at: number; cams: CctvCamera[] } | null = null;
const TTL = 5 * 60 * 1000;

export async function fetchIstanbulCameras(): Promise<CctvCamera[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.cams;
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://tkmservices.ibb.gov.tr/Web/api/Camera/v2/Details', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const arr: any[] = Array.isArray(data) ? data : (data.data || data.Data || []);
    for (const c of arr) {
      if (c.IsActive === false) continue;
      const lat = parseFloat(c.YCoord);
      const lng = parseFloat(c.XCoord);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const no = c.CameraNo;
      cams.push({
        id: `ibb-${no}`,
        lat,
        lng,
        name: (c.CameraName || `Kamera ${no}`).trim(),
        city: 'İstanbul',
        country: 'Türkiye',
        feed_url: c.CameraCaptureImage || `https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?cno=${no}`,
        source: 'İBB Trafik',
      });
    }
    if (cams.length) cache = { at: Date.now(), cams };
  } catch {
    /* boş dön */
  }
  return cams;
}

export default [] as CctvCamera[];
