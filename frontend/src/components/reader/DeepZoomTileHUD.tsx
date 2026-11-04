/**
 * Sprint 66 - Deep-Zoom Pyramidal Reader HUD & Viewport Radar Mini-Map
 *
 * Provides real-time LOD diagnostic stats, zoom buttons, and a zero-allocation
 * mini-map radar locator indicating current viewport bounds.
 * Strictly optimized for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter,
 * contain: layout paint (CLS = 0).
 */

import React from 'react';
import type { DeepZoomManifest, TileDescriptor } from '../../reader/useDeepZoomPanScan';

export interface DeepZoomTileHUDProps {
  isOpen: boolean;
  isPyramidal: boolean;
  scale: number;
  level: number;
  maxLevel: number;
  totalVisible: number;
  vramMbEstimated: number;
  panX: number;
  panY: number;
  manifest?: DeepZoomManifest | null;
  viewportWidth?: number;
  viewportHeight?: number;
  onToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onClose?: () => void;
}

export const DeepZoomTileHUD: React.FC<DeepZoomTileHUDProps> = ({
  isOpen,
  isPyramidal,
  scale,
  level,
  maxLevel,
  totalVisible,
  vramMbEstimated,
  panX,
  panY,
  manifest,
  viewportWidth = 1920,
  viewportHeight = 1080,
  onToggle,
  onZoomIn,
  onZoomOut,
  onReset,
  onClose,
}) => {
  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="deep-zoom-toggle-btn"
        aria-label="Activar Deep-Zoom Pan & Scan (Tecla Z)"
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-500 text-zinc-200 text-xs font-mono rounded shadow-lg transition-colors cursor-pointer"
        style={{ contain: 'layout paint' }}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="font-semibold text-emerald-400">Deep-Zoom</span>
        <span className="text-[10px] px-1 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">Z</span>
      </button>
    );
  }

  // Radar mini-map calculations
  const radarW = 80;
  const radarH = 50;
  const origW = manifest?.originalWidth || 4000;
  const origH = manifest?.originalHeight || 2600;

  // Viewport box projected inside radar
  const normScale = Math.max(0.01, scale);
  const viewW_page = Math.min(origW, viewportWidth / normScale);
  const viewH_page = Math.min(origH, viewportHeight / normScale);
  const viewX_page = Math.max(0, Math.min(origW - viewW_page, -panX / normScale));
  const viewY_page = Math.max(0, Math.min(origH - viewH_page, -panY / normScale));

  const radarBoxX = Math.round((viewX_page / origW) * radarW);
  const radarBoxY = Math.round((viewY_page / origH) * radarH);
  const radarBoxW = Math.max(8, Math.round((viewW_page / origW) * radarW));
  const radarBoxH = Math.max(6, Math.round((viewH_page / origH) * radarH));

  const zoomPercent = Math.round(scale * 100);
  const isVramSafe = vramMbEstimated <= 8.0;

  return (
    <div
      role="region"
      aria-label="Panel Deep-Zoom Radar & LOD"
      data-testid="deep-zoom-hud-panel"
      className="fixed bottom-6 right-6 z-40 w-72 bg-zinc-900 border border-zinc-700 rounded shadow-2xl p-3 text-zinc-200 font-sans text-xs select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isVramSafe ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="font-semibold text-zinc-100">Deep-Zoom Pyramidal HUD</span>
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              type="button"
              data-testid="deep-zoom-close-btn"
              aria-label="Cerrar Deep-Zoom HUD"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 px-1 font-mono text-sm leading-none"
            >&times;</button>
          )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-2 my-2 py-1 bg-zinc-950 p-2 rounded border border-zinc-800 font-mono text-[11px]">
        <div>
          <span className="text-zinc-500 block">NIVEL LOD</span>
          <span className="text-emerald-400 font-bold" data-testid="deep-zoom-level-stat">
            {isPyramidal ? `L${level} / L${maxLevel}` : 'L0 (Direct)'}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 block">TESELAS</span>
          <span className="text-zinc-200 font-bold" data-testid="deep-zoom-tiles-stat">
            {totalVisible} {totalVisible === 1 ? 'tesela' : 'teselas'}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 block">MEMORIA VRAM</span>
          <span
            className={`font-bold ${isVramSafe ? 'text-emerald-400' : 'text-amber-400'}`}
            data-testid="deep-zoom-vram-stat"
          >
            {vramMbEstimated} MB <span className="text-zinc-500 text-[9px]">(≤8MB)</span>
          </span>
        </div>
        <div>
          <span className="text-zinc-500 block">ZOOM</span>
          <span className="text-zinc-100 font-bold" data-testid="deep-zoom-scale-stat">
            {zoomPercent}%
          </span>
        </div>
      </div>

      {/* Radar Mini-Map & Controls */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {/* Radar Map */}
        <div
          data-testid="deep-zoom-radar"
          aria-label="Radar de navegación"
          className="relative bg-zinc-950 border border-zinc-800 rounded overflow-hidden"
          style={{ width: `${radarW}px`, height: `${radarH}px` }}
        >
          <div
            data-testid="deep-zoom-radar-rect"
            className="absolute border border-emerald-400 bg-emerald-500/20 pointer-events-none"
            style={{
              left: `${radarBoxX}px`,
              top: `${radarBoxY}px`,
              width: `${radarBoxW}px`,
              height: `${radarBoxH}px`,
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex gap-1">
            <button
              type="button"
              data-testid="deep-zoom-zoom-out-btn"
              aria-label="Alejar (-)"
              onClick={onZoomOut}
              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 rounded border border-zinc-700 text-center font-bold"
            >
              −
            </button>
            <button
              type="button"
              data-testid="deep-zoom-zoom-in-btn"
              aria-label="Acercar (+)"
              onClick={onZoomIn}
              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 rounded border border-zinc-700 text-center font-bold"
            >
              +
            </button>
          </div>
          <button
            type="button"
            data-testid="deep-zoom-reset-btn"
            aria-label="Restablecer Vista (0)"
            onClick={onReset}
            className="w-full py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 rounded border border-zinc-700 text-[10px] font-mono text-center"
          >
            Restablecer (100%)
          </button>
        </div>
      </div>

      {/* Keyboard Hint */}
      <div className="mt-2 text-[10px] text-zinc-500 font-mono text-center border-t border-zinc-800/60 pt-1">
        Atajos: <kbd className="text-zinc-400">Z</kbd> Salir · <kbd className="text-zinc-400">+ / -</kbd> Zoom · <kbd className="text-zinc-400">Flechas</kbd> Paneo
      </div>
    </div>
  );
};
