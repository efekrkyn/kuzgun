import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * KUZGU — Telegram OSINT API (Database Backend)
 * Fetches recent geolocation-tagged telegram posts from local SQLite DB.
 */

// We don't cache locally in memory as SQLite is already <1ms read time,
// but we set HTTP cache headers so Next.js/Browser can cache it.

let db: Database.Database | null = null;
function getDb(dbPath: string) {
  if (!db) db = new Database(dbPath, { readonly: true });
  return db;
}

function seededJitter(id: string, amp = 0.02): [number, number] {
  let h = 7;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [((h % 1000) / 1000 - 0.5) * amp, (((h >> 10) % 1000) / 1000 - 0.5) * amp];
}

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'kuzgu.db');
    
    // If worker hasn't created DB yet, return mock data for demonstration
    if (!fs.existsSync(dbPath)) {
      const mockFeeds = [
        { id: 'm1', title: 'Cyber Intel TR', description: 'Yeni sızıntı tespit edildi. Hedef: Enerji altyapısı.', link: 'https://t.me/cyberinteltr', published: new Date().toISOString(), source: 'telegram', risk_score: 85, coords: [39.92077, 32.85411], lat: 39.92077, lng: 32.85411 },
        { id: 'm2', title: 'Dark Web Market', description: 'Satılık kredi kartı veritabanı, TR bankaları dahil.', link: 'https://t.me/darkmarket', published: new Date().toISOString(), source: 'telegram', risk_score: 95, coords: [41.0082, 28.9784], lat: 41.0082, lng: 28.9784 },
        { id: 'm3', title: 'Hacktivist Grup', description: 'Yarınki DDoS saldırısı için hedefler belirlendi.', link: 'https://t.me/hacktivists', published: new Date().toISOString(), source: 'telegram', risk_score: 75, coords: [38.4192, 27.1287], lat: 38.4192, lng: 27.1287 },
        { id: 'm4', title: 'Rus Siber Ordusu', description: 'Operasyon hazırlıkları tamamlandı.', link: 'https://t.me/ruscyber', published: new Date().toISOString(), source: 'telegram', risk_score: 90, coords: [55.7558, 37.6173], lat: 55.7558, lng: 37.6173 },
        { id: 'm5', title: 'Lazarus Group Updates', description: 'Kripto borsa hedefleri sızdırıldı.', link: 'https://t.me/lazarus_updates', published: new Date().toISOString(), source: 'telegram', risk_score: 99, coords: [39.0392, 125.7625], lat: 39.0392, lng: 125.7625 },
        { id: 'm6', title: 'Kiev Direnişi', description: 'Askeri hareketlilik raporlandı.', link: 'https://t.me/kiev_res', published: new Date().toISOString(), source: 'telegram', risk_score: 60, coords: [50.4501, 30.5234], lat: 50.4501, lng: 30.5234 }
      ];
      return NextResponse.json({
        feeds: mockFeeds,
        total: mockFeeds.length,
        timestamp: new Date().toISOString(),
        note: 'Mock data used because kuzgu.db is missing.'
      });
    }

    const database = getDb(dbPath);
    
    // Fetch posts from the last 24 hours, highest risk first, then newest
    const stmt = database.prepare(`
      SELECT * FROM telegram_posts 
      WHERE datetime(published) >= datetime('now', '-7 days')
      ORDER BY published DESC
      LIMIT 1500
    `);
    
    const rows = stmt.all() as any[];

    const mappedItems = rows.map(row => {
      const [jitterLat, jitterLng] = seededJitter(row.id);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        link: row.link,
        published: row.published,
        source: row.source,
        risk_score: row.risk_score,
        coords: [row.lat + jitterLat, row.lng + jitterLng],
        lat: row.lat + jitterLat,
        lng: row.lng + jitterLng,
      };
    });

    return NextResponse.json({
      feeds: mappedItems,
      total: mappedItems.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });

  } catch (error: any) {
    console.error('[Telegram API] DB Error:', error.message);
    return NextResponse.json({ feeds: [], error: 'Failed to fetch telegram osint from DB' }, { status: 500 });
  }
}

