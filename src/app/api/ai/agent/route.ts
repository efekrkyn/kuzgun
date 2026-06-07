import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { runAgent, AgentError } from '@/lib/ai-agent';

// KUZGU AI OSINT agent — natural language → automated investigation via DeepSeek.
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 8, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let query = '';
  let history: any[] = [];
  try {
    const body = await req.json();
    query = (body.query || '').trim();
    if (Array.isArray(body.history)) {
      history = body.history
        .filter((h: any) => (h?.role === 'user' || h?.role === 'assistant') && typeof h?.content === 'string')
        .slice(-8);
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  if (query.length > 500) return NextResponse.json({ error: 'Query too long' }, { status: 400 });

  const origin = new URL(req.url).origin;
  try {
    const result = await runAgent(query, origin, history);
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof AgentError) return NextResponse.json({ error: e.message }, { status: e.status });
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Agent failed', detail }, { status: 502 });
  }
}
