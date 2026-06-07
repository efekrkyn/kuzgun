import Database from 'better-sqlite3';
import translate from 'google-translate-api-x';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Define DB path at project root
const dbPath = path.join(process.cwd(), 'kuzgu.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS telegram_posts (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    link TEXT,
    published TEXT,
    source TEXT,
    risk_score INTEGER,
    lat REAL,
    lng REAL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Prepared statements
const insertPost = db.prepare(`
  INSERT OR IGNORE INTO telegram_posts 
  (id, title, description, link, published, source, risk_score, lat, lng)
  VALUES (@id, @title, @description, @link, @published, @source, @risk_score, @lat, @lng)
`);

const cleanupOldPosts = db.prepare(`
  DELETE FROM telegram_posts WHERE datetime(published) < datetime('now', '-7 days')
`);

const CHANNELS = [
  // Core Military/Geopolitics
  'OSINTtechnical', 'Faytuks', 'Liveuamap', 'CyberKnow', 'tass_agency',
  'milinfolive', 'rybar', 'intelslava', 'ukraine_now', 'nexta_tv',
  
  // Middle East / Gaza / Israel
  'gaza_now', 'abualiexpress', 'manniefabian', 'qudsn', 'aljazeera',
  'hamasps', 'idf', 'amwajmedia', 'middleeasteye', 'auroraintel',
  
  // Turkey & Ankara Local OSINT
  'ankaratrafik', 'ankaracevirme', 'ankaragundemi', 'ankara_kusu',
  'savunmasanayist', 'clashreport', 'turdef', 'eha_news', 'conflicttr',
  
  'bellingcat', 'conflict_report', 'defmon3', 'the_lookout_n', 'orxhunter'
];

const RISK_KEYWORDS = ['war','missile','strike','attack','crisis','tension','military','conflict','defense','clash','nuclear','invasion','bomb','drone','weapon','sanctions','ceasefire','escalation', 'killed', 'destroyed', 'operation', 'casualty', 'frontline', 'threat', 'атака', 'взрыв', 'война', 'حرب', 'صاروخ', 'هجوم', 'patlama', 'saldırı', 'çatışma', 'füze', 'operasyon', 'kaza', 'trafik', 'yangın', 'olay', 'cinayet', 'polis'];

const KEYWORD_COORDS = {
  // Ankara Districts & Landmarks
  'kızılay': [39.9208, 32.8541], 'ulus': [39.9417, 32.8544], 'çankaya': [39.8710, 32.8644], 
  'keçiören': [39.9833, 32.8667], 'yenimahalle': [39.9610, 32.7972], 'mamak': [39.9431, 32.9234], 
  'etimesgut': [39.9453, 32.6734], 'sincan': [39.9614, 32.5769], 'gölbaşı': [39.7891, 32.8058],
  'eskişehir yolu': [39.9077, 32.7566], 'konya yolu': [39.8977, 32.8166], 'odtü': [39.8914, 32.7847],
  'bilkent': [39.8687, 32.7487], 'hacettepe': [39.8672, 32.7347], 'tunali': [39.9022, 32.8601],
  'bahçelievler': [39.9202, 32.8222], 'kızılay meydanı': [39.9208, 32.8541],
  
  // English
  'ukraine': [49.487, 31.272], 'kyiv': [50.450, 30.523], 'kharkiv': [50.000, 36.250], 'odessa': [46.482, 30.723],
  'russia': [61.524, 105.318], 'moscow': [55.755, 37.617], 'kursk': [51.730, 36.192], 'belgorod': [50.599, 36.598],
  'israel': [31.046, 34.851], 'tel aviv': [32.085, 34.781], 'jerusalem': [31.768, 35.213],
  'gaza': [31.416, 34.333], 'rafah': [31.280, 34.240], 'khan yunis': [31.346, 34.306],
  'iran': [32.427, 53.688], 'tehran': [35.689, 51.389], 'isfahan': [32.653, 51.666],
  'lebanon': [33.854, 35.862], 'beirut': [33.893, 35.501], 'south lebanon': [33.270, 35.200],
  'syria': [34.802, 38.996], 'damascus': [33.513, 36.292], 'aleppo': [36.202, 37.134],
  'turkey': [38.963, 35.243], 'ankara': [39.933, 32.859], 'istanbul': [41.008, 28.978], 'diyarbakir': [37.914, 40.230],
  
  // Cyrillic (Ukrainian / Russian)
  'київ': [50.450, 30.523], 'киев': [50.450, 30.523], 
  'харків': [50.000, 36.250], 'харьков': [50.000, 36.250],
  'одеса': [46.482, 30.723], 'одесса': [46.482, 30.723],
  'москва': [55.755, 37.617], 'курск': [51.730, 36.192], 'белгород': [50.599, 36.598],
  'россия': [61.524, 105.318], 'украина': [49.487, 31.272], 'україна': [49.487, 31.272],
  
  // Arabic
  'غزة': [31.416, 34.333], 'رفح': [31.280, 34.240], 'بيروت': [33.893, 35.501],
  'لبنان': [33.854, 35.862], 'إسرائيل': [31.046, 34.851], 'سوريا': [34.802, 38.996],
  'اليمن': [15.552, 48.516], 'صنعاء': [15.369, 44.191], 'طهران': [35.689, 51.389]
};

function scoreRisk(text) {
  const lower = text.toLowerCase();
  let score = 1;
  for (const kw of RISK_KEYWORDS) {
    if (lower.includes(kw)) score += 2;
  }
  return Math.min(10, score);
}

function findCoords(text) {
  const lower = text.toLowerCase();
  for (const [keyword, coords] of Object.entries(KEYWORD_COORDS)) {
    if (keyword.match(/^[a-z]+$/)) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(lower)) return coords;
    } else {
      if (lower.includes(keyword)) return coords;
    }
  }
  return null;
}

function parseTelegramHTML(html, channel) {
  const items = [];
  const messageBlockRegex = /<div class="tgme_widget_message_wrap js-widget_message_wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let blockMatch;

  while ((blockMatch = messageBlockRegex.exec(html)) !== null) {
    const blockHtml = blockMatch[0];
    const textRegex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i;
    const textMatch = blockHtml.match(textRegex);
    if (!textMatch) continue;
    
    const text = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    if (!text || text.length < 10) continue;

    const dateRegex = /<a class="tgme_widget_message_date" href="(https:\/\/t\.me\/[^"]+)".*?<time datetime="([^"]+)"/i;
    const dateMatch = blockHtml.match(dateRegex);
    const link = dateMatch ? dateMatch[1] : `https://t.me/${channel}`;
    const pubDate = dateMatch ? dateMatch[2] : new Date().toISOString();

    const title = text.split('\n')[0].substring(0, 100);

    items.push({ title, description: text, link, pubDate, source: `t.me/${channel}` });
  }
  return items;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runScraperCycle() {
  console.log(`[${new Date().toISOString()}] Starting Telegram scraper cycle for ${CHANNELS.length} channels...`);
  
  let totalNew = 0;

  for (const channel of CHANNELS) {
    try {
      // Fetch channel web preview
      const res = await fetch(`https://t.me/s/${channel}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 10000
      });
      
      if (!res.ok) {
        console.warn(`[WARN] Failed to fetch ${channel}: HTTP ${res.status}`);
        await sleep(2000);
        continue;
      }
      
      const html = await res.text();
      const posts = parseTelegramHTML(html, channel);
      
      let newPosts = 0;
      
      // Process and insert posts sequentially because we need async translation
      for (const post of posts) {
        const coords = findCoords(post.description || post.title);
        if (!coords) continue; // Only save geolocatable intel
        
        const riskScore = scoreRisk(post.description || post.title);
        const id = crypto.createHash('md5').update((post.link || '') + (post.pubDate || '')).digest('hex');
        
        // Translate to Turkish
        let finalTitle = post.title;
        let finalDesc = post.description;
        try {
           const tTitle = await translate(post.title, { to: 'tr', rejectOnPartialFail: false });
           if (tTitle?.text) finalTitle = tTitle.text;
           if (post.description) {
             const tDesc = await translate(post.description, { to: 'tr', rejectOnPartialFail: false });
             if (tDesc?.text) finalDesc = tDesc.text;
           }
        } catch (e) {
           console.warn(`[Translate Warn] ${e.message}`);
        }

        const info = insertPost.run({
          id,
          title: finalTitle,
          description: finalDesc,
          link: post.link,
          published: post.pubDate,
          source: post.source,
          risk_score: riskScore,
          lat: coords[0],
          lng: coords[1]
        });
        
        if (info.changes > 0) newPosts++;
      }
      
      totalNew += newPosts;
      console.log(`[OK] ${channel}: Parsed ${posts.length} posts, Inserted ${newPosts} new geolocated intel.`);
      
    } catch (e) {
      console.error(`[ERR] Failed to process ${channel}:`, e.message);
    }
    
    // Antiban sleep between channels
    await sleep(1500 + Math.random() * 1500);
  }
  
  // Cleanup posts older than 7 days
  const cleanup = cleanupOldPosts.run();
  console.log(`[CLEANUP] Removed ${cleanup.changes} old posts.`);
  
  console.log(`[${new Date().toISOString()}] Cycle completed. Total new intel added: ${totalNew}`);
}

async function startWorker() {
  // Infinite loop
  while (true) {
    await runScraperCycle();
    console.log('Sleeping for 10 minutes before next cycle...');
    await sleep(10 * 60 * 1000); // Wait 10 minutes between full cycles
  }
}

// Ensure scripts directory exists and start
if (!fs.existsSync(path.join(process.cwd(), 'scripts'))) {
  fs.mkdirSync(path.join(process.cwd(), 'scripts'));
}

startWorker().catch(console.error);
