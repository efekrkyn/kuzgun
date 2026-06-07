'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Activity, Sun, AlertTriangle, Camera, Flame, Target,
  CloudLightning, Radiation, Tv, Anchor, Ship, Newspaper,
  Network, Share2, Radio, Terminal, Users, MessageCircle, FileText, Car
} from 'lucide-react';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  isMobile?: boolean;
}

const LAYER_GROUPS = [
  {
    label: 'SDK',
    fullLabel: 'KUZGU SDK',
    color: '#1565C0',
    layers: [
      { key: 'sdk_sea', label: 'Denizcilik Hatları', icon: Anchor, color: '#4FC3F7', dataKey: 'sdk_entities' },
      { key: 'sdk_naval', label: 'Savunma Sanayii (Ankara)', icon: Target, color: '#00E5FF', dataKey: 'sdk_entities' },
    ],
  },
  {
    label: 'HAVACILIK',
    fullLabel: 'HAVACILIK',
    color: '#00E5FF',
    layers: [
      { key: 'flights', label: 'Ticari', icon: Plane, color: '#00E5FF', dataKey: 'commercial_flights' },
      { key: 'private', label: 'Özel', icon: Plane, color: '#00E676', dataKey: 'private_flights' },
      { key: 'jets', label: 'Özel Jetler', icon: Plane, color: '#FF69B4', dataKey: 'private_jets' },
      { key: 'military', label: 'Askeri', icon: Shield, color: '#FF3D3D', dataKey: 'military_flights' },
    ],
  },
  {
    label: 'DENİZCİLİK',
    fullLabel: 'DENİZ & UZAY',
    color: '#00BCD4',
    layers: [
      { key: 'maritime', label: 'Denizcilik / Donanma', icon: Ship, color: '#00BCD4', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: 'cables', label: 'Denizaltı Kabloları', icon: Share2, color: '#4FC3F7', dataKey: 'submarine_cables' },
      { key: 'satellites', label: 'Uydular', icon: Satellite, color: '#D4AF37', dataKey: 'satellites' },
    ],
  },
  {
    label: 'GÖZETİM',
    fullLabel: 'GÖZETİM',
    color: '#39FF14',
    layers: [
      { key: 'cctv', label: 'CCTV Kameralar', icon: Camera, color: '#39FF14', dataKey: 'cameras' },
      { key: 'radio', label: 'Taktiksel Telsiz', icon: Radio, color: '#FFEB3B', dataKey: 'radios' },
      { key: 'live_news', label: 'Canlı Haber', icon: Tv, color: '#FF4081', dataKey: 'live_feeds' },
      { key: 'telegram_osint', label: 'Telegram OSINT', icon: Terminal, color: '#00FFFF', dataKey: 'telegram_feeds' },
      { key: 'ankara_social', label: 'Sosyal Ağ & Radar (Ankara)', icon: Users, color: '#E1306C', dataKey: 'ankara_social' },
      { key: 'google_traffic', label: 'Trafik & Yol Durumu', icon: Car, color: '#FF5722', dataKey: 'none' },
    ],
  },
  {
    label: 'AFET',
    fullLabel: 'DOĞAL AFETLER',
    color: '#FF9500',
    layers: [
      { key: 'earthquakes', label: 'Depremler (24s)', icon: Activity, color: '#FF9500', dataKey: 'earthquakes' },
      { key: 'fires', label: 'Aktif Yangınlar', icon: Flame, color: '#FF6B00', dataKey: 'fires' },
      { key: 'weather', label: 'Şiddetli Hava', icon: CloudLightning, color: '#E040FB', dataKey: 'weather_events' },
    ],
  },
  {
    label: 'TEHDİT',
    fullLabel: 'TEHDİT & ALTYAPI',
    color: '#FF3D3D',
    layers: [
      { key: 'infrastructure', label: 'Nükleer Tesisler', icon: Radiation, color: '#76FF03', dataKey: 'infrastructure' },
      { key: 'global_incidents', label: 'Küresel Olaylar', icon: AlertTriangle, color: '#FF3D3D', dataKey: 'gdelt' },
      { key: 'gps_jamming', label: 'GPS Karıştırma', icon: Radio, color: '#FF4444', dataKey: 'gps_jamming' },
    ],
  },
  {
    label: 'AĞ',
    fullLabel: 'AĞ İSTİHBARATI',
    color: '#00E5FF',
    layers: [
      { key: 'internet_outages', label: 'İnternet Kesintileri', icon: Network, color: '#00E5FF', dataKey: 'ioda_outages' },
      { key: 'malware', label: 'Canlı Zararlı', icon: AlertTriangle, color: '#FF1744', dataKey: 'malware_threats' },
    ],
  },
  {
    label: 'GÖRÜNÜM',
    fullLabel: 'GÖRÜNÜM',
    color: '#448AFF',
    layers: [
      { key: 'day_night', label: 'Gece / Gündüz', icon: Sun, color: '#448AFF', dataKey: '' },
      { key: 'gibs', label: 'Uydu (NASA, günlük)', icon: Satellite, color: '#00E5FF', dataKey: '' },
    ],
  },
];

const ALL_LAYERS = LAYER_GROUPS.flatMap(g => g.layers);

// SVG component for Shield which was missing in the imports above
function Shield(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const toggle = (key: string) => setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  
  const getCount = (dk: string): number | null => {
    if (!dk) return null;
    let total = 0;
    let found = false;
    for (const k of dk.split(',')) {
      if (data[k] && Array.isArray(data[k])) {
        total += data[k].length;
        found = true;
      }
    }
    return found ? total : null;
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {LAYER_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div 
              className="text-[10px] font-bold font-mono tracking-widest border-b border-white/10 pb-1"
              style={{ color: group.color }}
            >
              {group.fullLabel}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.layers.map((layer) => {
                const isLayerActive = activeLayers[layer.key];
                const count = getCount(layer.dataKey);
                
                return (
                  <button
                    key={layer.key}
                    onClick={() => {
                      toggle(layer.key);
                    }}
                    className={`flex items-center gap-2 px-2 py-2 rounded border transition-colors ${
                      isLayerActive 
                        ? 'bg-white/10 border-white/20' 
                        : 'bg-transparent border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full border flex-shrink-0 transition-all ${
                        isLayerActive ? 'bg-current border-current scale-100' : 'bg-transparent border-white/30 scale-75'
                      }`}
                      style={{ color: isLayerActive ? layer.color : 'inherit', boxShadow: isLayerActive ? `0 0 8px ${layer.color}` : 'none' }}
                    />
                    <span className={`text-[9px] font-mono uppercase tracking-wider flex-1 text-left ${isLayerActive ? 'text-white' : 'text-white/60'}`}>
                      {layer.label}
                    </span>
                    {count !== null && (
                      <span className="text-[8px] font-mono tabular-nums opacity-60">
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 h-full w-[80px] border-r border-white/5 flex flex-col pt-32 pb-8 z-50 pointer-events-auto bg-black/20 backdrop-blur-[2px]">
      
      <div className="flex-1 flex flex-col gap-8 px-2">
        {LAYER_GROUPS.map((group) => {
          const groupActiveCount = group.layers.filter(l => activeLayers[l.key]).length;
          const isActive = groupActiveCount > 0;
          const isHovered = hoveredGroup === group.label;

          return (
            <div 
              key={group.label} 
              className="relative flex justify-center items-center"
              onMouseEnter={() => setHoveredGroup(group.label)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              {/* The Vertical Label */}
              <div 
                className={`text-[10px] font-mono font-bold cursor-pointer select-none transition-all duration-300 flex items-center justify-center`}
                style={{
                  writingMode: 'horizontal-tb',
                  color: isActive ? group.color : 'rgba(255, 255, 255, 0.4)',
                  textShadow: isActive ? `0 0 10px ${group.color}80` : 'none',
                  letterSpacing: '0.1em',
                  opacity: isActive || isHovered ? 1 : 0.5,
                }}
              >
                {/* Active Indicator dot */}
                {isActive && (
                  <div 
                    className="absolute -left-1 w-1 h-1 rounded-full animate-pulse"
                    style={{ backgroundColor: group.color, boxShadow: `0 0 8px ${group.color}` }}
                  />
                )}
                {group.label}
              </div>

              {/* Slide-out Menu */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -5, filter: 'blur(2px)' }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-[70px] top-1/2 -translate-y-1/2 min-w-[240px] bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl z-50 pointer-events-auto"
                    style={{
                      boxShadow: `0 0 30px ${group.color}15, inset 0 0 20px ${group.color}05`
                    }}
                  >
                    <div className="text-[11px] font-bold font-mono mb-3 tracking-widest border-b border-white/10 pb-2" style={{ color: group.color }}>
                      {group.fullLabel}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {group.layers.map((layer) => {
                        const isLayerActive = activeLayers[layer.key];
                        const count = getCount(layer.dataKey);
                        const Icon = layer.icon || Shield;
                        
                        return (
                          <button
                            key={layer.key}
                            onClick={() => toggle(layer.key)}
                            className="w-full flex items-center gap-3 px-2 py-1.5 rounded bg-transparent hover:bg-white/5 transition-colors group"
                          >
                            <div 
                              className={`w-2 h-2 rounded-full border flex-shrink-0 transition-all duration-300 ${isLayerActive ? 'bg-current border-current scale-100' : 'bg-transparent border-white/30 scale-75'}`}
                              style={{ color: isLayerActive ? layer.color : 'inherit', boxShadow: isLayerActive ? `0 0 8px ${layer.color}` : 'none' }}
                            />
                            <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 text-left transition-colors duration-200 ${isLayerActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                              {layer.label}
                            </span>
                            {count !== null && (
                              <span className="text-[9px] font-mono tabular-nums opacity-60">
                                {count.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(LayerPanel);
