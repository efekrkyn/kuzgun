'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, RefreshCw, MapPin, Camera, Maximize2, Brain } from 'lucide-react';
import Hls from 'hls.js';

interface CameraViewerProps {
  camera: any | null;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
}

export default function CameraViewer({ camera, onClose, onLocate }: CameraViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const streamType = camera?.stream_type || 'jpg';
  const externalFeedUrl = camera?.external_url || camera?.feed_url;
  const externalOnly = Boolean(camera?.external_url && !camera?.feed_url && !camera?.stream_url);

  useEffect(() => {
    if (!camera) return;
    setLoading(true);
    setError(false);
    setImageUrl(null);

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (externalOnly) {
      setLoading(false);
      return;
    }

    if (streamType === 'hls' && camera.stream_url) {
      if (Hls.isSupported() && videoRef.current) {
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(camera.stream_url);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) setError(true);
        });
      } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = camera.stream_url;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setLoading(false);
          videoRef.current?.play().catch(() => {});
        });
      }
      return;
    }

    if (streamType === 'iframe' && camera.stream_url) {
      setLoading(false);
      return;
    }

    // JPG fallback
    if (camera.feed_url) {
      const url = camera.feed_url.includes('?') ? `${camera.feed_url}&_t=${Date.now()}` : `${camera.feed_url}?_t=${Date.now()}`;
      setImageUrl(url);
    } else {
      setError(true);
      setLoading(false);
    }
  }, [camera, refreshKey, streamType, externalOnly]);

  // Auto-refresh for JPGs
  useEffect(() => {
    if (streamType !== 'jpg' || !camera?.feed_url) return;
    const iv = setInterval(() => setRefreshKey(k => k + 1), 5000); // 5s refresh for JPG
    return () => clearInterval(iv);
  }, [camera?.feed_url, streamType]);

  const analyzeImage = async () => {
    if (!imageUrl) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl, type: 'cctv' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiAnalysis(data);
    } catch (e) {
      console.error(e);
      alert('AI Analizi başarısız oldu veya API anahtarı geçersiz.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!camera) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`fixed z-[500] ${
          fullscreen 
            ? 'inset-2 md:inset-4' 
            : 'bottom-[70px] left-2 right-2 md:bottom-6 md:right-6 md:left-auto md:w-[420px]'
        }`}
      >
        <div className="glass-panel osiris-glow overflow-hidden h-full flex flex-col" style={{ borderColor: 'rgba(57, 255, 20, 0.3)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-[var(--border-secondary)] bg-black/40">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-2 h-2 rounded-full bg-[#39FF14] animate-osiris-pulse flex-shrink-0" />
              <Camera className="w-3.5 h-3.5 text-[#39FF14] flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-[10px] md:text-[11px] font-mono font-bold text-[#39FF14] tracking-wider truncate">{camera.name}</h3>
                <p className="text-[6px] md:text-[7px] font-mono text-[var(--text-muted)]">{camera.city}, {camera.country} · {camera.source}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {streamType === 'jpg' && (
                <button onClick={() => setRefreshKey(k => k + 1)} className="p-1.5 rounded hover:bg-[var(--hover-accent)] transition-colors" title="Yayını yenile">
                  <RefreshCw className="w-3 h-3 text-[var(--text-muted)] hover:text-[#39FF14]" />
                </button>
              )}
              {camera.lat && camera.lng && (
                <button onClick={() => onLocate?.(camera.lat, camera.lng)} className="p-1.5 rounded hover:bg-[var(--hover-accent)] transition-colors" title="Konuma git">
                  <MapPin className="w-3 h-3 text-[var(--text-muted)] hover:text-[var(--gold-primary)]" />
                </button>
              )}
              <button onClick={() => setFullscreen(!fullscreen)} className="hidden md:block p-1.5 rounded hover:bg-[var(--hover-accent)] transition-colors" title="Tam ekran">
                <Maximize2 className="w-3 h-3 text-[var(--text-muted)] hover:text-white" />
              </button>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-red-900/30 transition-colors">
                <X className="w-4 h-4 md:w-3 md:h-3 text-[var(--text-muted)] hover:text-red-400" />
              </button>
            </div>
          </div>

          {/* Camera Feed */}
          <div className={`relative bg-black ${fullscreen ? 'flex-1' : 'aspect-video max-h-[35vh] md:max-h-none'}`}>
            {loading && !error && !externalOnly && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-[8px] font-mono text-[#39FF14] tracking-widest">CONNECTING TO FEED...</span>
                </div>
              </div>
            )}

            {externalOnly ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                <div className="text-center px-6">
                  <div className="w-8 h-8 rounded-full bg-[#39FF14]/15 flex items-center justify-center mx-auto mb-2"><ExternalLink className="w-4 h-4 text-[#39FF14]" /></div>
                  <span className="text-[9px] font-mono text-[#39FF14] tracking-widest block mb-1">HARİCİ YAYIN</span>
                  <span className="text-[7px] font-mono text-[var(--text-muted)]">Canlı yayın kaynak görüntüleyicide açılır</span>
                  {externalFeedUrl && (
                    <a href={externalFeedUrl} target="_blank" rel="noopener noreferrer" className="block mx-auto mt-3 px-3 py-1 text-[8px] font-mono text-[#39FF14] border border-[#39FF14]/30 rounded hover:bg-[#39FF14]/10 transition-colors tracking-wider">
                      OPEN FEED
                    </a>
                  )}
                </div>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mb-2 mx-auto"><Camera className="w-4 h-4 text-red-400" /></div>
                  <span className="text-[9px] font-mono text-red-400 tracking-widest block mb-1">YAYIN YOK</span>
                  <span className="text-[7px] font-mono text-[var(--text-muted)]">Kamera çevrimdışı veya kısıtlı olabilir</span>
                  <button onClick={() => { setError(false); setRefreshKey(k => k + 1); }} className="block mx-auto mt-3 px-3 py-1 text-[8px] font-mono text-[#39FF14] border border-[#39FF14]/30 rounded hover:bg-[#39FF14]/10 transition-colors tracking-wider">
                    RETRY
                  </button>
                </div>
              </div>
            ) : streamType === 'hls' ? (
              <video
                ref={videoRef}
                className={`w-full ${fullscreen ? 'h-full object-contain' : 'h-full object-cover'}`}
                autoPlay
                muted
                playsInline
              />
            ) : streamType === 'iframe' && camera.stream_url ? (
              <iframe
                src={camera.stream_url}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : imageUrl ? (
              <img
                key={refreshKey}
                src={imageUrl}
                alt={camera.name}
                className={`w-full ${fullscreen ? 'h-full object-contain' : 'h-full object-cover'}`}
                onLoad={() => setLoading(false)}
                onError={() => { setLoading(false); setError(true); }}
              />
            ) : null}

            {/* Live indicator */}
            {!error && !loading && !externalOnly && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-1 rounded">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-osiris-pulse" />
                <span className="text-[7px] font-mono text-white tracking-widest">
                  {streamType === 'jpg' ? 'LIVE SNAPSHOT' : 'LIVE VIDEO'}
                </span>
              </div>
            )}

            {/* AI Analysis Overlay */}
            {aiAnalysis && (
              <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-md border-t border-[var(--gold-primary)]/50 p-2 z-20 max-h-[60%] overflow-y-auto">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-mono font-bold text-[var(--gold-primary)] flex items-center gap-1"><Brain className="w-3 h-3"/> AI OTONOM RAPOR</span>
                  <button onClick={() => setAiAnalysis(null)}><X className="w-3 h-3 text-white/50 hover:text-white"/></button>
                </div>
                <div className="text-[9px] text-white/90 mb-1 leading-snug">{aiAnalysis.summary}</div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="text-[7px] text-[var(--text-muted)] block">THREAT LEVEL</span>
                    <span className={`text-[9px] font-bold ${aiAnalysis.threat_level==='HIGH'?'text-red-500':aiAnalysis.threat_level==='MEDIUM'?'text-orange-400':'text-green-400'}`}>
                      {aiAnalysis.threat_level}
                    </span>
                  </div>
                  <div>
                    <span className="text-[7px] text-[var(--text-muted)] block">ENTITIES</span>
                    <span className="text-[8px] text-[#00E5FF] leading-tight block">{aiAnalysis.entities?.join(', ')}</span>
                  </div>
                </div>
                <div className="mt-2 text-[8px] text-[var(--text-secondary)] leading-relaxed bg-white/5 p-1.5 rounded border border-white/10">
                  {aiAnalysis.details}
                </div>
              </div>
            )}
          </div>

          {/* Footer with coords + links */}
          <div className="px-3 md:px-4 py-2 border-t border-[var(--border-secondary)] bg-black/40 flex items-center justify-between">
            <div className="text-[7px] md:text-[8px] font-mono text-[var(--text-muted)]">
              {camera.lat?.toFixed(4)}, {camera.lng?.toFixed(4)}
            </div>
            <div className="flex gap-2">
              {streamType === 'jpg' && imageUrl && (
                <button onClick={analyzeImage} disabled={analyzing}
                  className="flex items-center gap-1 text-[7px] font-mono text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20 px-1.5 py-0.5 rounded border border-[var(--gold-primary)]/40 transition-colors tracking-wider disabled:opacity-50">
                  <Brain className={`w-2.5 h-2.5 ${analyzing ? 'animate-pulse' : ''}`} /> {analyzing ? 'ANALYZING...' : 'AI ANALYSIS'}
                </button>
              )}
              {(camera.feed_url || camera.external_url || (streamType === 'iframe' && camera.stream_url)) && (
                <a href={camera.external_url || camera.feed_url || (streamType === 'iframe' ? camera.stream_url : undefined)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[7px] font-mono text-[#39FF14] hover:underline tracking-wider">
                  <ExternalLink className="w-2.5 h-2.5" /> FEED
                </a>
              )}
              <a href={`https://www.google.com/maps/@${camera.lat},${camera.lng},17z`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[7px] font-mono text-[var(--cyan-primary)] hover:underline tracking-wider">
                <MapPin className="w-2.5 h-2.5" /> MAP
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
