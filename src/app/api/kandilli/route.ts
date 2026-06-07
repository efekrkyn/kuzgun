import { NextResponse } from 'next/server';

/**
 * KUZGU — Kandilli Rasathanesi Sismik Ağ API'si
 * Fetches real-time seismic events from Kandilli Observatory (Turkey)
 */

export async function GET() {
  try {
    const url = 'http://www.koeri.boun.edu.tr/scripts/lst9.asp';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ earthquakes: [], error: 'Kandilli unavailable' });
    }

    const html = await res.text();
    // Parse the PRE tag content which contains the text table
    const preMatch = html.match(/<pre>([\s\S]*?)<\/pre>/i);
    let lines: string[] = [];
    
    if (preMatch && preMatch[1]) {
      lines = preMatch[1].split('\n');
    } else {
      // Fallback if <pre> is not found, split by newline and find the data
      lines = html.split('\n');
    }

    const earthquakes: any[] = [];
    let started = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('----------')) {
        started = true;
        continue;
      }
      if (!started || line === '') continue;

      // Example line:
      // 2026.06.06 16:40:16  39.1203   28.2972       11.1      -.-  1.5  -.-   YUREGIL-SINDIRGI (BALIKESIR)                      İlksel
      
      const parts = line.split(/\s+/);
      if (parts.length < 10) continue;

      const dateStr = parts[0]; // 2026.06.06
      const timeStr = parts[1]; // 16:40:16
      const lat = parseFloat(parts[2]);
      const lng = parseFloat(parts[3]);
      const depth = parseFloat(parts[4]);
      
      // Magnitude can be in MD, ML, Mw columns. Usually ML is at index 6
      const magStr = parts[6];
      const magnitude = magStr !== '-.-' ? parseFloat(magStr) : parseFloat(parts[5]);
      
      // Place is everything after magnitude until "İlksel" or "REVIZE"
      const placeParts = [];
      for (let j = 8; j < parts.length; j++) {
        if (parts[j].includes('lksel') || parts[j].includes('REVIZE') || parts[j].includes('lksel')) break;
        placeParts.push(parts[j]);
      }
      const place = placeParts.join(' ');

      // Convert to UTC timestamp
      // Turkey is UTC+3. Date format is YYYY.MM.DD HH:MM:SS
      const [year, month, day] = dateStr.split('.');
      const [hour, min, sec] = timeStr.split(':');
      // Create a Date object in UTC assuming the time is Turkey Time (UTC+3)
      const dateObj = new Date(Date.UTC(parseInt(year), parseInt(month)-1, parseInt(day), parseInt(hour)-3, parseInt(min), parseInt(sec)));

      earthquakes.push({
        id: `kandilli_${dateObj.getTime()}_${lat}_${lng}`,
        lat,
        lng,
        depth,
        magnitude: isNaN(magnitude) ? 0 : magnitude,
        place: place || 'TURKEY',
        time: dateObj.getTime(),
        url: 'http://www.koeri.boun.edu.tr/scripts/lst9.asp',
        source: 'KANDILLI'
      });
      
      // Limit to last 200 events to save bandwidth
      if (earthquakes.length >= 200) break;
    }

    return NextResponse.json({
      earthquakes,
      total: earthquakes.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Kandilli fetch error:', error);
    return NextResponse.json({ earthquakes: [], error: 'Failed to fetch Kandilli data' }, { status: 500 });
  }
}
