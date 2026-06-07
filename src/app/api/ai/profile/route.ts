import { NextResponse } from 'next/server';
import { createGeminiClient, rotateApiKey } from '@/lib/ai-engine';

export const dynamic = 'force-dynamic';

function getEnvApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim().length > 0) {
      keys.push(key.trim());
    }
  }
  return keys;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { target, data, type } = body;

    const userKey = request.headers.get('x-gemini-key')?.trim();
    let apiKey: string;
    if (userKey && userKey.length > 0) {
      apiKey = userKey;
    } else {
      const envKeys = getEnvApiKeys();
      if (envKeys.length === 0) {
        return NextResponse.json({ error: 'No Gemini API key configured.' }, { status: 503 });
      }
      apiKey = rotateApiKey(envKeys);
    }

    const client = createGeminiClient(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Sen KUZGU İstihbarat Platformu'nun "Hedef Profilleme" yapay zekasısın (KUZGU AI).
Aşağıdaki OSINT verilerini kullanarak hedefin dijital ayak izini, psikolojik profilini ve olası davranış örüntülerini analiz et.

Hedef (${type}): ${target}
Bulunan Veriler: ${JSON.stringify(data)}

Raporunu aşağıdaki formatta, profesyonel bir siber istihbarat diliyle, Türkçe ve Markdown formatında oluştur:
## 👤 HEDEF PROFİLİ: ${target}
**Dijital Ayak İzi:** (Kullandığı platformlara göre teknoloji yatkınlığı ve sosyalliği)
**Olası İlgi Alanları:** (Örn: Sadece oyun platformlarındaysa oyuncu, Github/StackOverflow varsa yazılımcı vb.)
**Risk ve Gizlilik Skoru:** (Kendisini internette ne kadar gizleyebilmiş? 1-10 arası bir puan)
**Analiz:** (Hedefin davranışları hakkında detaylı çıkarım)`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return NextResponse.json({ profile: response.text() });
  } catch (err: any) {
    console.error('AI Profiling error:', err);
    return NextResponse.json({ error: 'Profilleme başarısız: ' + err.message }, { status: 500 });
  }
}
