/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Identity permutation generator
 *
 *  Inspired by social-analyzer's name analysis: turn a real name (+
 *  optional nickname / birth year / custom domain) into the username
 *  and email permutations people commonly use, to pivot into the
 *  USERNAME and EMAIL ACCOUNT modules. Pure string generation.
 * ═══════════════════════════════════════════════════════════════
 */

export interface PermInput {
  name: string;
  nick?: string;
  year?: string;   // birth year, e.g. 1995
  domain?: string; // custom email domain
}

export interface PermResult {
  usernames: string[];
  emails: string[];
}

const PROVIDERS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'proton.me', 'icloud.com'];

const clean = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

export function generatePermutations(input: PermInput): PermResult {
  const tokens = input.name.trim().split(/\s+/).map(clean).filter(Boolean);
  const first = tokens[0] || '';
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : '';
  const nick = input.nick ? clean(input.nick) : '';
  const fi = first[0] || '';
  const li = last[0] || '';

  const years: string[] = [];
  if (input.year && /^\d{4}$/.test(input.year)) {
    years.push(input.year, input.year.slice(2));
  }

  const seps = ['', '.', '_', '-'];
  const bases = new Set<string>();

  const add = (v: string) => { if (v) bases.add(v); };

  // single tokens
  add(first); add(last); add(nick);

  // first+last combos with separators
  if (first && last) {
    for (const s of seps) {
      add(`${first}${s}${last}`);
      add(`${last}${s}${first}`);
    }
    add(`${fi}${last}`);        // jsmith
    add(`${first}${li}`);       // johns
    add(`${fi}.${last}`);       // j.smith
    add(`${first}.${li}`);      // john.s
    add(`${last}${fi}`);        // smithj
    add(`${fi}${li}`);          // js
    add(`${li}${fi}`);          // sj
  }

  // nickname combos
  if (nick && last) {
    for (const s of seps) add(`${nick}${s}${last}`);
    add(`${li}${nick}`);
  }

  // year suffixes on the strongest bases
  const baseList = [...bases];
  for (const b of baseList) {
    for (const y of years) {
      add(`${b}${y}`);
      add(`${b}_${y}`);
    }
  }

  const usernames = [...bases]
    .filter((u) => u.length >= 2 && u.length <= 30)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));

  // emails: top usernames × providers (+ custom domain)
  const domains = input.domain ? [clean(input.domain).replace(/[^a-z0-9.]/g, '') + (input.domain.includes('.') ? '' : '')] : [];
  const allDomains = [...new Set([...(input.domain ? [input.domain.toLowerCase().trim()] : []), ...PROVIDERS])];
  const topUsers = usernames.slice(0, 12);
  const emails: string[] = [];
  for (const u of topUsers) {
    for (const d of allDomains) {
      if (d && d.includes('.')) emails.push(`${u}@${d}`);
    }
  }

  return { usernames, emails: emails.slice(0, 60) };
}
