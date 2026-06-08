import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

let _keyIndex = 0;
function rotateApiKey(keys: string[]): string {
  if (keys.length === 0) throw new Error('No API keys available');
  const key = keys[_keyIndex % keys.length];
  _keyIndex = (_keyIndex + 1) % keys.length;
  return key;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoUnix = Math.floor(thirtyDaysAgo.getTime() / 1000);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0];

  try {
    // 1. Fetch Hacker News
    const hnRes = await fetch(`http://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&numericFilters=created_at_i>${thirtyDaysAgoUnix}&hitsPerPage=5`);
    const hnData = await hnRes.json();
    const hnSnippets = hnData.hits.map((h: any) => `[HN] ${h.title || 'Comment'}: ${h.story_text || h.comment_text || ''}`.substring(0, 300)).join('\n');

    // 2. Fetch GitHub
    const ghRes = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+created:>${thirtyDaysAgoISO}&sort=stars&order=desc&per_page=5`, {
      headers: { 'User-Agent': 'KuzgunOSINT/1.0' }
    });
    const ghData = await ghRes.json();
    const ghSnippets = (ghData.items || []).map((repo: any) => `[GitHub] ${repo.full_name} (${repo.stargazers_count} stars): ${repo.description}`).join('\n');

    // Combine data
    const combinedData = `
### Hacker News (Last 30 Days)
${hnSnippets || 'No significant activity found.'}

### GitHub Repositories (Last 30 Days)
${ghSnippets || 'No significant activity found.'}
    `.trim();

    // Generate AI Summary
    const keys = getEnvApiKeys();
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No Gemini API keys found' }, { status: 500 });
    }
    const apiKey = rotateApiKey(keys);
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: 'You are KUZGUN OSINT Analyst. Summarize the provided intelligence data regarding the requested target from the last 30 days. Provide a short, highly analytical briefing in markdown format. Highlight public sentiment, developer activity, and key events. Do not fabricate information. Use a cyber-intelligence tone.',
    });

    const prompt = `TARGET: ${q}\n\nRAW OSINT DATA:\n${combinedData}\n\nProvide the 30-day OSINT briefing.`;
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({
      target: q,
      brief: result.response.text(),
      raw_data: { hn: hnData.hits.length, github: (ghData.items || []).length }
    });

  } catch (error: any) {
    console.error('OSINT Last30Days Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
