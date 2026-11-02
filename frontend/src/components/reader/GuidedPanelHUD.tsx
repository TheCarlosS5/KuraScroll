/**
 * KuraScroll Guided Panel Pacer HUD
 * Sprint 68 - Topological Boustrophedon Pacing & Auto-Framing Controls
 *
 * Hardware-tuned for Intel GMA 4500MHD:
 * Zero CSS blur, zero backdrop-filter, pure solid containment #18181b, CLS = 0.
 */

import React from 'react';
import { UseGuidedPanelPacerResult } from '../../reader/useGuidedPanelPacer';

export interface GuidedPanelHUDProps {
  pacer: UseGuidedPanelPacerResult;
  className?: string;
}

export const GuidedPanelHUD: React.FC<GuidedPanelHUDProps> = ({
  pacer,
  className = '',
}) => {
  const {
    isPacingActive,
    activePanelIndex,
    totalPanels,
    isAutoPlay,
    readingMode,
    framing,
    togglePacing,
    nextPanel,
    prevPanel,
    toggleAutoPlay,
  } = pacer;

  if (totalPanels === 0) {
    return null;
  }

  const currentDisplayIndex = isPacingActive ? activePanelIndex + 1 : 0;
  const progressPct = isPacingActive && totalPanels > 0
    ? Math.round(((activePanelIndex + 1) / totalPanels) * 100)
    : 0;

  return (
    <div
      data-testid="guided-panel-hud"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none ${className}`}
      style={{
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
      }}
      role="region"
      aria-label="Controles de lectura guiada por viñetas"
    >
      {/* Top progress strip */}
      {isPacingActive && (
        <div
          data-testid="panel-progress-track"
          className="w-full h-1 bg-zinc-800 rounded-t-lg overflow-hidden"
        >
          <div
            data-testid="panel-progress-fill"
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-zinc-200">
        {/* Toggle Pacing Button */}
        <button
          type="button"
          data-testid="toggle-pacing-btn"
          onClick={togglePacing}
          className={`px-2.5 py-1 rounded font-medium transition-colors ${
            isPacingActive
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
          }`}
          title="Alternar modo viñeta a viñeta (Tecla P)"
        >
          {isPacingActive ? '⛶ Modo Viñeta' : '▢ Página Completa'}
        </button>

        {/* Panel Counter Badge */}
        <div
          data-testid="panel-counter-badge"
          className="flex items-center gap-1.5 font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-300"
        >
          {isPacingActive ? (
            <>
              <span className="text-indigo-400 font-bold">{currentDisplayIndex}</span>
              <span className="text-zinc-500">/</span>
              <span>{totalPanels}</span>
              {framing?.isSplash && (
                <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-400 font-sans font-semibold">
                  Splash
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-400 font-sans">{totalPanels} viñetas</span>
          )}
        </div>

        {/* Reading Mode Indicator */}
        <div
          data-testid="reading-mode-badge"
          className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700"
        >
          {readingMode === 'manga'
            ? 'RTL Manga'
            : readingMode === 'comic'
            ? 'LTR Comic'
            : 'Webtoon'}
        </div>

        {/* Navigation Step Buttons */}
        {isPacingActive && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="prev-panel-btn"
              onClick={prevPanel}
              disabled={activePanelIndex === 0}
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-200 transition-colors"
              title="Viñeta anterior (Flecha Izquierda)"
              aria-label="Viñeta anterior"
            >
              ◀
            </button>
            <button
              type="button"
              data-testid="next-panel-btn"
              onClick={nextPanel}
              disabled={activePanelIndex >= totalPanels - 1}
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-200 transition-colors"
              title="Viñeta siguiente (Espacio o Flecha Derecha)"
              aria-label="Viñeta siguiente"
            >
              ▶
            </button>
          </div>
        )}

        {/* Auto-Play Toggle Button */}
        {isPacingActive && (
          <button
            type="button"
            data-testid="autoplay-toggle-btn"
            onClick={toggleAutoPlay}
            className={`px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
              isAutoPlay
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            title="Auto-pacing continuo manos libres (Tecla A)"
          >
            <span>{isAutoPlay ? '⏸ Auto' : '▶ Auto'}</span>
          </button>
        )}

        {/* Keyboard shortcut hint */}
        <span className="hidden md:inline-block text-[11px] text-zinc-500 border-l border-zinc-700 pl-2">
          [P] Viñeta · [Espacio] Avanzar · [A] Auto
        </span>
      </div>
    </div>
  );
};
