import { NextResponse } from 'next/server';

export async function GET() {
  const radioStations = [
    // LiveATC Feeds (Aviation)
    {
      id: 'radio-jfk', lat: 40.6413, lng: -73.7781,
      name: 'New York JFK - Tower / App', city: 'New York', country: 'US',
      stream_url: 'http://s1-fmt2.liveatc.net/kjfk_twr_app', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-ord', lat: 41.9742, lng: -87.9073,
      name: "Chicago O'Hare - Tower", city: 'Chicago', country: 'US',
      stream_url: 'http://s1-fmt2.liveatc.net/kord_twr', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-lax', lat: 33.9416, lng: -118.4085,
      name: 'Los Angeles LAX - Tower', city: 'Los Angeles', country: 'US',
      stream_url: 'http://s1-fmt2.liveatc.net/klax_twr', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-lhr', lat: 51.4700, lng: -0.4543,
      name: 'London Heathrow - Tower', city: 'London', country: 'UK',
      stream_url: 'http://s1-fmt2.liveatc.net/egll_twr', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-ltfm', lat: 41.2753, lng: 28.7519,
      name: 'Istanbul Airport - App/Dep', city: 'Istanbul', country: 'Turkey',
      stream_url: 'http://s1-fmt2.liveatc.net/ltfm_app', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-rjtt', lat: 35.5494, lng: 139.7798,
      name: 'Tokyo Haneda - Tower', city: 'Tokyo', country: 'Japan',
      stream_url: 'http://s1-fmt2.liveatc.net/rjtt_twr', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-omdb', lat: 25.2532, lng: 55.3657,
      name: 'Dubai DXB - Approach', city: 'Dubai', country: 'UAE',
      stream_url: 'http://s1-fmt2.liveatc.net/omdb_app', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-eddf', lat: 50.0379, lng: 8.5622,
      name: 'Frankfurt - Tower', city: 'Frankfurt', country: 'Germany',
      stream_url: 'http://s1-fmt2.liveatc.net/eddf_twr', category: 'Aviation', source: 'LiveATC'
    },
    {
      id: 'radio-ymml', lat: -37.6690, lng: 144.8410,
      name: 'Melbourne - Tower', city: 'Melbourne', country: 'Australia',
      stream_url: 'http://s1-fmt2.liveatc.net/ymml_twr', category: 'Aviation', source: 'LiveATC'
    },
    // Broadcastify Feeds (Police / Fire / EMS)
    {
      id: 'radio-chi-police', lat: 41.8781, lng: -87.6298,
      name: 'Chicago Police Citywide', city: 'Chicago', country: 'US',
      stream_url: 'https://broadcastify.cdnstream1.com/26221', category: 'Police', source: 'Broadcastify'
    },
    {
      id: 'radio-lapd', lat: 34.0522, lng: -118.2437,
      name: 'LAPD Dispatch', city: 'Los Angeles', country: 'US',
      stream_url: 'https://broadcastify.cdnstream1.com/5765', category: 'Police', source: 'Broadcastify'
    },
    {
      id: 'radio-nypd', lat: 40.7128, lng: -74.0060,
      name: 'NYPD Citywide', city: 'New York', country: 'US',
      stream_url: 'https://broadcastify.cdnstream1.com/32684', category: 'Police', source: 'Broadcastify'
    }
  ];

  return NextResponse.json({
    radios: radioStations,
    total: radioStations.length,
    timestamp: new Date().toISOString()
  });
}
