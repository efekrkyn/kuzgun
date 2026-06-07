import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url, type } = await req.json();
    if (!url) return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });

    // Fetch the image
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) throw new Error('Could not fetch image from camera');
    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured for Computer Vision');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Sen KUZGU sisteminin "Otonom Görüntü Analisti" yapay zekasısın. Ekteki güvenlik kamerası (CCTV) / trafik kamerası görüntüsünü incele.
    
Lütfen aşağıdaki formatta JSON dön:
{
  "summary": "Kısa genel özet (örn: Yoğun trafik, olay yok)",
  "entities": ["Araçlar", "Yayalar", "Askeri Araç", "Trafik Işıkları" vb. tespit edilenler],
  "threat_level": "LOW" | "MEDIUM" | "HIGH",
  "threat_reason": "Neden bu risk seviyesini seçtiğin (eğer risk yoksa 'Normal durum' yaz)",
  "details": "Görüntüdeki araç sayısı tahmini, hava durumu, ve dikkat çeken olağandışı herhangi bir durum."
}

Sadece saf JSON dön, markdown kullanma.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);

    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Vision AI error:', error);
    return NextResponse.json({ error: error.message || 'Vision analysis failed' }, { status: 500 });
  }
}
