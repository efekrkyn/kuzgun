import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';
import { getClientIp } from '@/lib/ssrf-guard';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const campaignId = params.id;
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'Unknown';
  
  // Basic device detection
  let deviceType = 'Desktop';
  if (/mobile/i.test(userAgent)) deviceType = 'Mobile';
  if (/tablet/i.test(userAgent)) deviceType = 'Tablet';

  // Geolocation using ip-api.com
  let lat = 0, lng = 0, city = 'Unknown', country = 'Unknown';
  if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${clientIp}`, { signal: AbortSignal.timeout(3000) });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.status === 'success') {
          lat = geoData.lat;
          lng = geoData.lon;
          city = geoData.city;
          country = geoData.country;
        }
      }
    } catch (e) {
      console.warn('IP Geo failed for', clientIp);
    }
  }

  // If local dev, assign a random location for testing
  if (lat === 0 && lng === 0) {
     lat = 39.9 + (Math.random() - 0.5) * 5;
     lng = 32.8 + (Math.random() - 0.5) * 5;
     city = 'Local Test';
     country = 'TR';
  }

  try {
    const db = getDb();
    const logId = crypto.randomUUID();
    
    const stmt = db.prepare(`
      INSERT INTO honeypot_logs 
      (id, campaign_id, ip_address, user_agent, device_type, lat, lng, city, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(logId, campaignId, clientIp, userAgent, deviceType, lat, lng, city, country);
  } catch (error) {
    console.error('Honeypot log error:', error);
  }

  // Redirect to a harmless page (like Google or a fake 404)
  return NextResponse.redirect('https://www.google.com/search?q=404+not+found');
}
