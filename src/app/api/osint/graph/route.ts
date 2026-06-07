import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { expandNode } from '@/lib/osint-graph';

// OSINT correlation graph — expand a node into its connected entities by
// chaining KUZGU's own OSINT modules. Powers the entity-graph pivot.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TYPES = new Set(['domain', 'host', 'ip', 'email', 'username', 'org', 'service', 'person', 'country', 'telegram', 'crypto']);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') || '').toLowerCase().trim();
  const id = (searchParams.get('id') || '').trim();

  if (!TYPES.has(type)) {
    return NextResponse.json({ error: `Invalid type`, nodes: [], links: [] }, { status: 400 });
  }
  if (!id || id.length > 253) {
    return NextResponse.json({ error: 'Invalid id', nodes: [], links: [] }, { status: 400 });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded', nodes: [], links: [] }, { status: 429 });
  }

  try {
    const origin = new URL(req.url).origin;
    const graph = await expandNode(type, id, origin);
    return NextResponse.json(graph);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detail, nodes: [], links: [] }, { status: 502 });
  }
}
