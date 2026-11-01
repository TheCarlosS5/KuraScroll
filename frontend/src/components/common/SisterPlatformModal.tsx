import React, { useState, useEffect } from 'react';
import { ExternalLink, X, Film, BookOpen, CheckCircle, Wifi, Monitor } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface SisterPlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SisterPlatformModal({ isOpen, onClose }: SisterPlatformModalProps) {
  const [streamUrl, setStreamUrl] = useState(() => {
    return localStorage.getItem('kurastream_companion_url') || 'http://localhost:3000';
  });
  const [streamOnline, setStreamOnline] = useState<boolean | null>(null);
  const modalRef = useFocusTrap({ isOpen, onClose });

  useEffect(() => {
    if (!isOpen) return;
    // Check if KuraStream companion instance is accessible
    const controller = new AbortController();
    fetch(`${streamUrl}/health`, { method: 'GET', signal: controller.signal, mode: 'no-cors' })
      .then(() => setStreamOnline(true))
      .catch(() => setStreamOnline(false));

    return () => controller.abort();
  }, [isOpen, streamUrl]);

  const handleSaveUrl = (url: string) => {
    setStreamUrl(url);
    localStorage.setItem('kurastream_companion_url', url);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="companion-modal-title"
        className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#0d121f] p-6 shadow-2xl text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-[0_0_15px_rgba(0,229,255,0.4)]">
              <span className="font-black text-white text-lg tracking-wider">KS</span>
            </div>
            <div>
              <h2 id="companion-modal-title" className="text-xl font-bold tracking-tight text-white">
                Ecosistema Hermano KS
              </h2>
              <p className="text-xs text-slate-400">Plataformas unificadas KuraStream & KuraScroll</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platforms Grid */}
        <div className="grid grid-cols-2 gap-4 my-6">
          {/* KuraScroll (Active) */}
          <div className="rounded-xl border border-cyan-500/50 bg-cyan-950/20 p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-cyan-400 bg-cyan-900/50 px-2 py-0.5 rounded-full border border-cyan-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> Activo
            </div>
            <BookOpen className="w-8 h-8 text-cyan-400 mb-2" />
            <h3 className="font-bold text-white text-base">KuraScroll</h3>
            <p className="text-xs text-slate-400 mt-1">Mangas, Manhwas, Manhuas & Webtoons en lectura ultra fluida.</p>
          </div>

          {/* KuraStream (Sister) */}
          <div className="rounded-xl border border-purple-500/40 bg-purple-950/20 p-4 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-900/50 px-2 py-0.5 rounded-full border border-purple-500/30">
              {streamOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> En línea
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Local
                </>
              )}
            </div>
            <div>
              <Film className="w-8 h-8 text-purple-400 mb-2" />
              <h3 className="font-bold text-white text-base">KuraStream</h3>
              <p className="text-xs text-slate-400 mt-1">Streaming de animes y películas en alta fidelidad.</p>
            </div>
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              Abrir KuraStream <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Companion Config */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 mb-4">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Dirección Local de KuraStream:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => handleSaveUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Configura la URL de tu instancia local de KuraStream para alternar entre lectura y visualización en un clic.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
