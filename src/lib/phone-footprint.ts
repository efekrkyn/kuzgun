/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Phone OSINT Footprint (phoneinfoga port)
 *
 *  Native TypeScript port of sundowndev/phoneinfoga's keyless Google
 *  "dork" generator. Given a parsed number it produces ready-to-run
 *  search queries / URLs that footprint the number across social
 *  media, reputation/scam-report sites, and disposable-SMS providers
 *  — no API key required, just search links the operator can open.
 * ═══════════════════════════════════════════════════════════════
 */

export interface Dork {
  label: string;
  query: string;
  url: string;
}

export interface PhoneFootprint {
  general: Dork[];
  social: Dork[];
  reputation: Dork[];
  disposable: Dork[];
}

const SOCIAL_SITES = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'vk.com'];
const REPUTATION_SITES = [
  'whosenumber.info', 'findwhocallsme.com', 'yellowpages.ca', 'phonenumbers.ie',
  'who-calledme.com', 'usphonesearch.net', 'whocalled.us', 'quinumero.info',
  'truecaller.com', 'sync.me',
];
const DISPOSABLE_SITES = [
  'hs3x.com', 'receive-sms-now.com', 'smslisten.com', 'smsnumbersonline.com',
  'freesmscode.com', 'catchsms.com', 'smstibo.com', 'smsreceiving.com',
  'getfreesmsnumber.com', 'sellaite.com', 'receive-sms-online.info',
  'receivesmsonline.com', 'receive-a-sms.com', 'sms-receive.net',
  'receivefreesms.com', 'receive-sms.com', 'receivetxt.com', 'freephonenum.com',
  'freesmsverification.com', 'receive-sms-online.com', 'smslive.co',
];

const G = 'https://www.google.com/search?q=';
const intext = (s: string) => `intext:"${s}"`;
const url = (q: string) => G + encodeURIComponent(q);

interface NumFormats {
  e164: string;        // +15556661212
  intlNoPlus: string;  // 15556661212
  rawLocal: string;    // 5556661212
  national: string;    // (555) 666-1212
}

function siteDork(site: string, formats: NumFormats, parts: string[]): Dork {
  const intexts = parts.map(intext).join(' | ');
  const query = `site:${site} ${intexts}`;
  return { label: site, query, url: url(query) };
}

export function buildPhoneFootprint(f: NumFormats): PhoneFootprint {
  const social = SOCIAL_SITES.map((s) =>
    siteDork(s, f, [f.intlNoPlus, f.e164, f.rawLocal]));

  const reputation = REPUTATION_SITES.map((s) =>
    siteDork(s, f, [f.intlNoPlus, f.rawLocal]));

  const disposable = DISPOSABLE_SITES.map((s) =>
    siteDork(s, f, [f.intlNoPlus, f.rawLocal]));

  const generalQuery = [f.e164, f.intlNoPlus, f.rawLocal, f.national]
    .map(intext).join(' | ');
  const general: Dork[] = [
    { label: 'General mentions', query: generalQuery, url: url(generalQuery) },
    {
      label: 'Documents (pdf/doc/xls)',
      query: `${intext(f.e164)} (filetype:pdf | filetype:doc | filetype:xls | filetype:csv)`,
      url: url(`${intext(f.e164)} (filetype:pdf | filetype:doc | filetype:xls | filetype:csv)`),
    },
    {
      label: 'Pastebin / leaks',
      query: `${intext(f.intlNoPlus)} (site:pastebin.com | site:throwbin.io | site:ghostbin.com)`,
      url: url(`${intext(f.intlNoPlus)} (site:pastebin.com | site:throwbin.io | site:ghostbin.com)`),
    },
  ];

  return { general, social, reputation, disposable };
}
