/**
 * KuraScroll Offline Storage Vault & Quota Arbiter HUD
 * Sprint 72 - Visual Quota Bar, Pin Management & Smart Eviction Controls
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { OfflineChapterItem } from '../../reader/useStorageVault';

export interface StorageVaultHUDProps {
  isOpen: boolean;
  onClose: () => void;
  usedBytes: number;
  totalBytes: number;
  thresholdPercent: number; // e.g. 75
  chapters: OfflineChapterItem[];
  onTogglePin: (chapterId: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onQuickCleanup: () => void;
}

export const StorageVaultHUD: React.FC<StorageVaultHUDProps> = ({
  isOpen,
  onClose,
  usedBytes,
  totalBytes,
  thresholdPercent,
  chapters,
  onTogglePin,
  onDeleteChapter,
  onQuickCleanup,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const totalGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
  const percentUsed = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;
  const isOverThreshold = percentUsed >= thresholdPercent;

  return (
    <div
      data-testid="storage-vault-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label="Gestor de Almacenamiento Offline"
    >
      <div
        className="w-full max-w-lg p-6 rounded-2xl shadow-2xl text-gray-200 flex flex-col gap-5 border border-zinc-800"
        style={{
          backgroundColor: '#18181b',
          contain: 'layout paint',
          transform: 'translateZ(0)',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Bóveda Offline & Cuota
            </h2>
            <p className="text-xs text-zinc-400">Control de espacio local y protección contra evicción</p>
          </div>
          <button
            data-testid="vault-close-btn"
            onClick={onClose}
            className="text-zinc-400 hover:text-white cursor-pointer text-lg leading-none p-1"
            aria-label="Cerrar bóveda"
          >&times;</button>
        </div>

        {/* Quota Progress Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className={isOverThreshold ? 'text-amber-400 font-bold' : 'text-zinc-300'}>
              {usedGb} GB usados ({percentUsed}%)
            </span>
            <span className="text-zinc-400">{totalGb} GB límite origen</span>
          </div>

          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex">
            <div
              data-testid="quota-progress-bar"
              className={`h-full transition-all duration-300 ${
                isOverThreshold ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        {/* Chapter List */}
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {chapters.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-xs">
              No hay capítulos guardados offline en la bóveda
            </div>
          ) : (
            chapters.map((ch) => (
              <div
                key={ch.id}
                data-testid={`chapter-item-${ch.id}`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-gray-200">
                    {ch.seriesTitle} - Cap. {ch.chapterNumber}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-400">{ch.sizeMb} MB</span>
                    {ch.status === 'unread' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300">
                        No leído
                      </span>
                    )}
                    {ch.status === 'completed' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        Leído
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    data-testid={`pin-btn-${ch.id}`}
                    onClick={() => onTogglePin(ch.id)}
                    className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                      ch.isPinned
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {ch.isPinned ? 'Fijado' : 'Fijar'}
                  </button>
                  <button
                    data-testid={`delete-btn-${ch.id}`}
                    onClick={() => onDeleteChapter(ch.id)}
                    className="px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Cleanup Button */}
        <button
          data-testid="quick-cleanup-btn"
          onClick={onQuickCleanup}
          className="w-full py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors"
        >
          Limpieza Inteligente (Liberar Capítulos Leídos)
        </button>
      </div>
    </div>
  );
};
