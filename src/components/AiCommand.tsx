'use client';

/**
 * KUZGU — AI Command (DeepSeek OSINT agent)
 * Natural-language investigation: type a target, the agent runs the right
 * OSINT modules and returns a synthesized report.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, Send, Wrench } from 'lucide-react';

interface Step { tool: string; args: Record<string, unknown>; summary: string; }
interface Msg { role: 'user' | 'assistant'; text: string; steps?: Step[]; model?: string; }

const SUGGESTIONS = [
  'Bana Karadeniz bölgesini göster ve askeri gemileri aç',
  'Investigate github.com',
  'Find accounts for email test@gmail.com',
  'Sadece İngiltere trafik kameralarını göster',
];

function renderMd(t: string): string {
  return t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<div style="color:#D4AF37;font-weight:700;margin-top:8px">$1</div>')
    .replace(/^## (.*)$/gm, '<div style="color:#D4AF37;font-weight:700;font-size:12px;margin-top:10px">$1</div>')
    .replace(/^# (.*)$/gm, '<div style="color:#D4AF37;font-weight:700;font-size:13px;margin-top:10px">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<b style="color:#E8E6E0">$1</b>')
    .replace(/^[-*] (.*)$/gm, '<div style="padding-left:10px">• $1</div>')
    .replace(/`([^`]+)`/g, '<code style="background:#ffffff14;padding:1px 4px;border-radius:3px">$1</code>')
    .replace(/\n/g, '<br/>');
}

export default function AiCommand({ onMapCommand }: { onMapCommand?: (cmds: any[]) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  useEffect(() => {
    const handleAiCommand = (e: CustomEvent) => {
      const query = e.detail;
      if (typeof query === 'string') {
        setOpen(true);
        setTimeout(() => send(query), 100); // Wait a bit for open animation
      }
    };
    window.addEventListener('ai-command', handleAiCommand as EventListener);
    return () => window.removeEventListener('ai-command', handleAiCommand as EventListener);
  }, [msgs, loading]);

  const send = async (q?: string) => {
    const query = (q ?? input).trim();
    if (!query || loading) return;
    // Prior conversation (before this new message) for multi-turn context
    const history = msgs.map((m) => ({ role: m.role, content: m.text })).slice(-8);
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: query }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMsgs((m) => [...m, { role: 'assistant', text: data.report, steps: data.steps, model: data.model }]);
      
      if (data.mapCommands && data.mapCommands.length > 0 && onMapCommand) {
        onMapCommand(data.mapCommands);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: `⚠ ${e instanceof Error ? e.message : 'Agent error'}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title="KUZGU AI Analyst"
        className="fixed bottom-5 right-5 z-[9998] w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{ background: 'linear-gradient(135deg,#D4AF37,#8a6d1f)', border: '1px solid #D4AF3760' }}>
        <Sparkles className="w-5 h-5 text-black" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="fixed bottom-20 right-5 z-[9998] w-[440px] max-w-[92vw] h-[600px] max-h-[80vh] flex flex-col rounded-xl overflow-hidden"
            style={{ background: 'rgba(10,10,9,0.96)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-primary)]">
              <Sparkles className="w-4 h-4 text-[var(--gold-primary)]" />
              <span className="hud-text text-[12px] text-[var(--text-primary)]">AI ANALYST</span>
              <span className="text-[8px] font-mono text-[var(--text-muted)]">DeepSeek V3 + R1</span>
              <button onClick={() => setOpen(false)} className="ml-auto p-1 hover:bg-white/5 rounded"><X className="w-3.5 h-3.5 text-white/50" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {msgs.length === 0 && (
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  <div className="mb-2">Doğal dille bir hedef yaz; KUZGU doğru modülleri kendi çalıştırıp rapor verir.</div>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="block w-full text-left px-2 py-1.5 mb-1 rounded border border-white/10 hover:border-[var(--gold-primary)]/40 hover:text-[var(--gold-primary)] transition-colors">{s}</button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                  {m.role === 'user' ? (
                    <span className="inline-block text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-[var(--gold-primary)]/15 text-[var(--text-primary)] border border-[var(--gold-primary)]/30">{m.text}</span>
                  ) : (
                    <div>
                      {m.steps && m.steps.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {m.steps.map((s, j) => (
                            <span key={j} className="inline-flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded border border-[#00E5FF]/30 text-[#00E5FF]">
                              <Wrench className="w-2 h-2" />{s.tool}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-[11px] font-mono text-[var(--text-secondary)] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMd(m.text) }} />
                      {m.model && <div className="text-[8px] font-mono text-[var(--text-muted)] mt-1">{m.model}</div>}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--gold-primary)]" /> Araştırılıyor — modüller çalışıyor (uzun sürebilir)…
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="p-2.5 border-t border-[var(--border-primary)] flex gap-1.5">
              <input
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="örn: github.com'u araştır" disabled={loading}
                className="flex-1 bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none" />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="px-3 rounded-lg bg-[var(--gold-primary)]/20 border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] disabled:opacity-30">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
