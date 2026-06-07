import { NextResponse } from 'next/server';
import dns from 'dns/promises';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

const HOMOGLYPHS: Record<string, string[]> = {
  'a': ['e', 'o', 'c'],
  'b': ['d', 'p', 'q', 'v'],
  'c': ['e', 'o', 'a'],
  'd': ['b', 'p', 'q'],
  'e': ['a', 'c', 'o'],
  'g': ['q', 'y', 'p'],
  'h': ['n', 'b', 'k'],
  'i': ['l', 'j', '1'],
  'l': ['i', '1', 'I'],
  'm': ['n', 'rn'],
  'n': ['m', 'r', 'h'],
  'o': ['0', 'c', 'e', 'a'],
  'p': ['q', 'b', 'd'],
  'q': ['p', 'g', '9'],
  'r': ['n', 't', 'f'],
  's': ['5', 'z'],
  't': ['f', 'r', 'l'],
  'u': ['v', 'y', 'n'],
  'v': ['u', 'w', 'b'],
  'w': ['vv', 'v'],
  'y': ['v', 'j', 'u'],
  'z': ['s', '2']
};

function generateVariations(domainName: string): Set<string> {
  const vars = new Set<string>();

  // Omission (remove one char)
  for (let i = 0; i < domainName.length; i++) {
    vars.add(domainName.slice(0, i) + domainName.slice(i + 1));
  }

  // Insertion (add common typo char or repeat)
  for (let i = 0; i <= domainName.length; i++) {
    const chars = ['s', 'a', 'e', 'i', 'o', 'u', '1', '0', '-'];
    if (i < domainName.length) chars.push(domainName[i]); // repeat char
    for (const c of chars) {
      vars.add(domainName.slice(0, i) + c + domainName.slice(i));
    }
  }

  // Substitution / Homoglyph
  for (let i = 0; i < domainName.length; i++) {
    const char = domainName[i];
    if (HOMOGLYPHS[char]) {
      for (const h of HOMOGLYPHS[char]) {
        vars.add(domainName.slice(0, i) + h + domainName.slice(i + 1));
      }
    }
  }

  // Transposition (swap adjacent)
  for (let i = 0; i < domainName.length - 1; i++) {
    if (domainName[i] !== domainName[i + 1]) {
      vars.add(
        domainName.slice(0, i) +
        domainName[i + 1] +
        domainName[i] +
        domainName.slice(i + 2)
      );
    }
  }

  // Remove the original
  vars.delete(domainName);
  
  return vars;
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('target') || '').trim().toLowerCase();

  if (!target || !target.includes('.')) {
    return NextResponse.json({ error: 'Geçerli bir domain girin (örn: google.com)' }, { status: 400 });
  }

  // Basic validation and extraction
  let cleanTarget = target.replace(/^https?:\/\//, '').split('/')[0];
  const parts = cleanTarget.split('.');
  
  if (parts.length < 2) {
    return NextResponse.json({ error: 'Geçersiz domain formatı' }, { status: 400 });
  }

  const tld = parts.slice(1).join('.');
  const baseName = parts[0];

  // Generate variations
  const rawVariations = Array.from(generateVariations(baseName));
  // Shuffle and limit to 50 to avoid timing out the Vercel/Next.js function (DNS resolution takes time)
  const shuffled = rawVariations.sort(() => 0.5 - Math.random()).slice(0, 50);

  const results = [];

  // Batch resolve DNS concurrently
  const promises = shuffled.map(async (v) => {
    const vDomain = `${v}.${tld}`;
    try {
      // Small timeout for DNS lookup to not hang
      const ipController = new AbortController();
      const ipTimeout = setTimeout(() => ipController.abort(), 2000);
      const addresses = await Promise.race([
        dns.resolve4(vDomain),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500))
      ]);
      clearTimeout(ipTimeout);
      
      let mx = false;
      try {
        const mxRecords = await Promise.race([
          dns.resolveMx(vDomain),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
        ]);
        if (mxRecords && (mxRecords as any).length > 0) mx = true;
      } catch (e) { /* ignore MX failures */ }

      return { domain: vDomain, active: true, ips: addresses, mx };
    } catch (error: any) {
      // ENOTFOUND or timeout means the domain is likely not registered/active
      return { domain: vDomain, active: false, ips: [], mx: false };
    }
  });

  const resolved = await Promise.all(promises);

  // Sort active first
  resolved.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));

  const totalActive = resolved.filter(r => r.active).length;

  return NextResponse.json({
    target: cleanTarget,
    baseName,
    tld,
    totalGenerated: rawVariations.length,
    scanned: resolved.length,
    totalActive,
    variations: resolved
  });
}
