/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Photo EXIF / metadata OSINT
 *
 *  Fetches an image by URL and extracts EXIF metadata: camera make/
 *  model, lens, software, capture timestamp, dimensions — and most
 *  importantly GPS coordinates, which geolocate where a photo was
 *  taken. SSRF-guarded (host validated before fetch).
 * ═══════════════════════════════════════════════════════════════
 */

import exifr from 'exifr';
import { validateHost } from './ssrf-guard';

export interface ExifResult {
  url: string;
  hasExif: boolean;
  gps: { lat: number; lng: number } | null;
  camera: {
    make?: string;
    model?: string;
    lens?: string;
    software?: string;
  };
  dateTaken: string | null;
  dimensions: { width?: number; height?: number };
  extra: Record<string, unknown>;
  bytes: number;
}

export class ExifError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function parseImageExif(url: string): Promise<ExifResult> {
  const target = url.includes('://') ? url : `https://${url}`;
  let u: URL;
  try { u = new URL(target); } catch { throw new ExifError(400, 'Invalid image URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ExifError(400, 'Only http/https URLs');

  const check = await validateHost(u.hostname);
  if (!check.ok) throw new ExifError(400, `Blocked target — ${check.reason}`);

  let buf: ArrayBuffer;
  try {
    const res = await fetch(u.href, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KUZGU-EXIF/1.0)' },
    });
    if (!res.ok) throw new ExifError(502, `Image fetch failed (HTTP ${res.status})`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/') && !ct.includes('octet-stream')) {
      throw new ExifError(415, `Not an image (content-type: ${ct || 'unknown'})`);
    }
    buf = await res.arrayBuffer();
  } catch (e) {
    if (e instanceof ExifError) throw e;
    throw new ExifError(502, `Could not fetch image: ${(e as Error).message}`);
  }

  let data: any = null;
  try {
    data = await exifr.parse(buf, {
      gps: true,
      tiff: true,
      ifd0: true,
      exif: true,
      // keep a useful subset
      pick: undefined,
    });
  } catch {
    data = null;
  }

  const gps = (data && typeof data.latitude === 'number' && typeof data.longitude === 'number')
    ? { lat: data.latitude, lng: data.longitude }
    : null;

  // a few extra interesting tags if present
  const extra: Record<string, unknown> = {};
  for (const k of ['ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'Flash', 'Orientation', 'GPSAltitude', 'Artist', 'Copyright']) {
    if (data && data[k] !== undefined) extra[k] = data[k];
  }

  const dt = data?.DateTimeOriginal || data?.CreateDate || data?.ModifyDate || null;

  return {
    url: u.href,
    hasExif: !!data && Object.keys(data).length > 0,
    gps,
    camera: {
      make: data?.Make,
      model: data?.Model,
      lens: data?.LensModel || data?.LensInfo,
      software: data?.Software,
    },
    dateTaken: dt ? new Date(dt).toISOString() : null,
    dimensions: { width: data?.ExifImageWidth || data?.ImageWidth, height: data?.ExifImageHeight || data?.ImageHeight },
    extra,
    bytes: buf.byteLength,
  };
}
