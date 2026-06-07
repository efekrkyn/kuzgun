import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ip = (searchParams.get('ip') || '').trim();
  if (!ip) {
    return NextResponse.json({ error: 'Eksik IP parametresi' }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Limit aşıldı.' }, { status: 429 });
  }

  if (!process.env.ABUSECH_API_KEY) {
    return NextResponse.json({ error: 'ThreatFox için ücretsiz ABUSECH_API_KEY gerekli (auth.abuse.ch)' }, { status: 503 });
  }

  try {
    const res = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Auth-Key': process.env.ABUSECH_API_KEY
      },
      body: JSON.stringify({ query: 'search_ioc', search_term: ip }),
      signal: AbortSignal.timeout(10_000)
    });

    if (!res.ok) {
      throw new Error('ThreatFox API HTTP hatası');
    }

    const data = await res.json();
    
    if (data.query_status === 'no_result') {
      return NextResponse.json({ ip, threat_found: false, data: [] });
    }

    if (data.query_status === 'ok') {
      // deduplicate by malware name if multiple reports
      const uniqueThreats = Array.from(new Map(data.data.map((item: any) => [item.malware_printable, item])).values());
      return NextResponse.json({ ip, threat_found: true, data: uniqueThreats });
    }

    return NextResponse.json({ ip, threat_found: false, data: [] });

  } catch (err: any) {
    return NextResponse.json({ error: 'Threat Intel sorgusu başarısız oldu.', detail: err.message }, { status: 502 });
  }
}
