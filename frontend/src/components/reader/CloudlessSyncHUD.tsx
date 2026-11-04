/**
 * KuraScroll Continuous Reading Session Milestones & Autonomous Cloudless Sync HUD
 * Sprint 85 - CloudlessSync Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { SyncMode, SYNC_MODE_LABELS } from '../../reader/useCloudlessSync';

export interface CloudlessSyncHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  mode: SyncMode;
  localDeviceId: string;
  activePeerCount: number;
  vectorClock: number;
  chaptersCompleted: number;
  totalReadingSeconds: number;
  streakDays: number;
  isSyncing: boolean;
  milestoneUnlocked: string | null;
  onToggleEnabled: () => void;
  onChangeMode: (mode: SyncMode) => void;
  onDismissMilestone: () => void;
}

export const CloudlessSyncHUD: React.FC<CloudlessSyncHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  mode,
  localDeviceId,
  activePeerCount,
  vectorClock,
  chaptersCompleted,
  totalReadingSeconds,
  streakDays,
  isSyncing,
  milestoneUnlocked,
  onToggleEnabled,
  onChangeMode,
  onDismissMilestone,
}) => {
  // ESC and 'Y' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'y') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const modeList: SyncMode[] = ['local_broadcast', 'p2p_direct', 'offline_vault'];
  const readingHours = Math.floor(totalReadingSeconds / 3600);
  const readingMinutes = Math.floor((totalReadingSeconds % 3600) / 60);

  return (
    <>
      {/* Non-intrusive Floating Milestone Toast */}
      {milestoneUnlocked && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-4 rounded-xl border border-amber-500/50 shadow-2xl animate-bounce"
          style={{
            backgroundColor: '#18181b',
            color: '#f4f4f5',
          }}
        >
          <div className="text-amber-400 font-bold text-sm">INSIGNIA</div>
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              ¡Hito de Lectura Desbloqueado!
            </div>
            <div className="text-sm font-semibold text-zinc-100">{milestoneUnlocked}</div>
          </div>
          <button
            onClick={onDismissMilestone}
            className="ml-2 text-zinc-400 hover:text-zinc-200 text-xs p-1"
            aria-label="Cerrar notificación de hito"
          >&times;</button>
        </div>
      )}

      {/* Main Sync HUD Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Panel de Sincronización Local sin Nube e Hitos"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            contain: 'layout style',
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-700 shadow-2xl p-6 flex flex-col gap-5"
            style={{
              backgroundColor: '#18181b', // Pure solid containment for GMA 4500MHD
              color: '#f4f4f5',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/30">
                  SYNC
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">
                    CloudlessSync • Sincronizador Local
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Malla descentralizada CRDT sin servidores (Atajo: 'Y')
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                aria-label="Cerrar panel de sincronización local"
              >&times;</button>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
              <div>
                <span className="text-sm font-medium text-zinc-200">
                  Sincronización P2P / Baliza Activa
                </span>
                <p className="text-xs text-zinc-400">
                  Transmite y recibe hitos con otros lectores en la red
                </p>
              </div>
              <button
                role="switch"
                aria-checked={isEnabled}
                onClick={onToggleEnabled}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                  isEnabled
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
              </button>
            </div>

            {/* Sync Mode Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-300">
                Topología de Red Local
              </label>
              <div className="grid grid-cols-3 gap-2">
                {modeList.map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => onChangeMode(m)}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-colors ${
                        active
                          ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      <span className="text-xs font-semibold">{SYNC_MODE_LABELS[m].name}</span>
                      <span className="text-[10px] text-zinc-500 line-clamp-1">
                        {SYNC_MODE_LABELS[m].description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Milestones & Progress Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Capítulos Leídos</span>
                <span className="text-xl font-bold text-indigo-400 font-mono">
                  {chaptersCompleted}
                </span>
                <span className="text-[10px] text-zinc-500">Hito próximo en 25 / 50</span>
              </div>

              <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Racha de Lectura</span>
                <span className="text-xl font-bold text-amber-400 font-mono">
                  {streakDays} días racha
                </span>
                <span className="text-[10px] text-zinc-500">Sesión continua</span>
              </div>

              <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Tiempo de Lectura</span>
                <span className="text-base font-bold text-zinc-200 font-mono">
                  {readingHours}h {readingMinutes}m
                </span>
                <span className="text-[10px] text-zinc-500">Acumulado en RAM</span>
              </div>

              <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Reloj Vectorial CRDT</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  v{vectorClock}
                </span>
                <span className="text-[10px] text-zinc-500">Monotonía garantizada</span>
              </div>
            </div>

            {/* Device Identity & Sync Status Bar */}
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-zinc-400">{localDeviceId}</span>
              </div>
              <div className="text-zinc-400">
                Pares: <span className="text-indigo-400">{activePeerCount}</span>
              </div>
              <div>
                <span className={isSyncing ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}>
                  {isSyncing ? 'SINCRONIZANDO...' : 'AL DÍA (SYNCED)'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1 border-t border-zinc-800 text-xs">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
