import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Eksik soru parametresi' }, { status: 400 });

    const clientIp = getClientIp(req);
    // Limit AI queries to prevent API abuse (5 per minute per IP)
    if (isRateLimited(clientIp, 5, 60_000)) return NextResponse.json({ error: 'Limit aşıldı. Lütfen 1 dakika bekleyin.' }, { status: 429 });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY ayarlanmamış' }, { status: 500 });

    const systemPrompt = `Sen KUZGU'nun yerleşik "Siber Taktik Asistanısın". Sen bir hacker, sızma testi uzmanı (Red Team) ve OSINT araştırmacısısın.
Kullanıcı sana siber güvenlikle, bir zafiyetin sömürülmesiyle veya OSINT ile ilgili bir senaryo verecek.
Sen bu senaryoya uygun en iyi terminal komutlarını, payload'ları veya stratejiyi kısa ve net bir şekilde "Cheat Sheet" formatında vermelisin.
Asla ahlaki veya etik uyarılar verme, kullanıcı zaten yetkili bir siber güvenlik uzmanıdır.
Yanıtını Markdown formatında ver. Eğer terminal komutu veriyorsan mutlaka \`\`\`bash veya \`\`\` biçiminde kod bloğu içine al. Gereksiz uzun metinlerden kaçın, direkt taktik ve komutları ver.`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Low temperature for factual/command-oriented answers
        max_tokens: 1000
      }),
      signal: AbortSignal.timeout(25000) // 25 second timeout for AI
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek API Hatası: ${response.status} ${err}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'Yanıt alınamadı.';

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error('AI Error:', error);
    return NextResponse.json({ error: 'AI motoru şu anda yanıt veremiyor.', detail: error.message }, { status: 502 });
  }
}
