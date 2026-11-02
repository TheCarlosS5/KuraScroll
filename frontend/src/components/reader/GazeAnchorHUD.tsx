/**
 * KuraScroll Predictive Gaze Heatmap Trajectory & Eye Fixation Anti-Drift HUD
 * Sprint 83 - GazeAnchor Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { GazeMode, HeatmapResolution, GazeAnchorPoint, GAZE_MODE_LABELS } from '../../reader/useGazeAnchor';

export interface GazeAnchorHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  mode: GazeMode;
  saccadeSensitivity: number;
  dwellThresholdMs: number;
  driftTolerancePx: number;
  returnAnchorEnabled: boolean;
  heatmapResolution: HeatmapResolution;
  currentAnchor: GazeAnchorPoint | null;
  isDriftActive: boolean;
  saccadeCount: number;
  onToggleEnabled: () => void;
  onToggleReturnAnchor: () => void;
  onChangeMode: (mode: GazeMode) => void;
  onChangeSensitivity: (val: number) => void;
  onChangeDwellThreshold: (val: number) => void;
  onChangeDriftTolerance: (val: number) => void;
  onChangeHeatmapResolution: (res: HeatmapResolution) => void;
  onResetAnchor: () => void;
}

export const GazeAnchorHUD: React.FC<GazeAnchorHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  mode,
  saccadeSensitivity,
  dwellThresholdMs,
  driftTolerancePx,
  returnAnchorEnabled,
  heatmapResolution,
  currentAnchor,
  isDriftActive,
  saccadeCount,
  onToggleEnabled,
  onToggleReturnAnchor,
  onChangeMode,
  onChangeSensitivity,
  onChangeDwellThreshold,
  onChangeDriftTolerance,
  onChangeHeatmapResolution,
  onResetAnchor,
}) => {
  // ESC and 'G' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'g') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modeList: GazeMode[] = ['manga_rtl', 'webtoon', 'manga_ltr'];
  const resList: HeatmapResolution[] = ['low', 'medium', 'high'];

  return (
    <div
      role="dialog"
      aria-label="Panel de Anclaje de Mirada y Estabilización Anti-Deriva"
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
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/30">
              👁️
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                GazeAnchor • Estabilizador Óptico
              </h2>
              <p className="text-xs text-zinc-400">
                Fijación sacádica y corrección de deriva visual (Atajo: 'G')
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Cerrar panel de anclaje de mirada"
          >
            ✕
          </button>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
          <div>
            <span className="text-sm font-medium text-zinc-200">
              Estabilización de Enfoque Activa
            </span>
            <p className="text-xs text-zinc-400">
              Bloquea micro-temblores y guía la trayectoria de lectura
            </p>
          </div>
          <button
            role="switch"
            aria-checked={isEnabled}
            onClick={onToggleEnabled}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              isEnabled
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
          </button>
        </div>

        {/* Reading Mode Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-300">
            Modo de Trayectoria de Lectura
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
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  <span className="text-xs font-semibold">{GAZE_MODE_LABELS[m].name}</span>
                  <span className="text-[10px] text-zinc-500 line-clamp-1">
                    {GAZE_MODE_LABELS[m].description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-3 bg-zinc-900/80 p-3.5 rounded-lg border border-zinc-800">
          {/* Sensitivity */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Sensibilidad Sacádica</span>
              <span className="text-emerald-400 font-mono">{saccadeSensitivity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.05"
              value={saccadeSensitivity}
              onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-zinc-800 cursor-pointer h-1.5 rounded"
            />
          </div>

          {/* Dwell Threshold */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Umbral de Fijación (Dwell)</span>
              <span className="text-emerald-400 font-mono">{dwellThresholdMs} ms</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="25"
              value={dwellThresholdMs}
              onChange={(e) => onChangeDwellThreshold(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 bg-zinc-800 cursor-pointer h-1.5 rounded"
            />
          </div>

          {/* Drift Tolerance */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Tolerancia Anti-Deriva (Deadband)</span>
              <span className="text-emerald-400 font-mono">{driftTolerancePx.toFixed(1)} px</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={driftTolerancePx}
              onChange={(e) => onChangeDriftTolerance(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-zinc-800 cursor-pointer h-1.5 rounded"
            />
          </div>
        </div>

        {/* Heatmap Resolution & Return Anchor Toggle */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-xs text-zinc-300 font-medium">Resolución Mapa Calor</span>
            <div className="flex gap-1 mt-1">
              {resList.map((res) => (
                <button
                  key={res}
                  onClick={() => onChangeHeatmapResolution(res)}
                  className={`flex-1 py-1 text-[11px] font-semibold rounded uppercase transition-colors ${
                    heatmapResolution === res
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
            <div>
              <span className="text-xs text-zinc-300 font-medium">Retorno Focal</span>
              <p className="text-[10px] text-zinc-500">Auto-snap al perder lectura</p>
            </div>
            <button
              role="switch"
              aria-checked={returnAnchorEnabled}
              onClick={onToggleReturnAnchor}
              className={`px-2 py-1 rounded text-[11px] font-semibold border ${
                returnAnchorEnabled
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {returnAnchorEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Live Telemetry Readout */}
        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-zinc-500">Foco Actual: </span>
            <span className="text-zinc-300">
              {currentAnchor ? `${currentAnchor.x}px, ${currentAnchor.y}px` : 'En espera...'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Anti-Deriva: </span>
            <span className={isDriftActive ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
              {isDriftActive ? 'FIJADO (LOCKED)' : 'LIBRE'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Sacadas: </span>
            <span className="text-zinc-300">{saccadeCount}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-1 border-t border-zinc-800 text-xs">
          <button
            onClick={onResetAnchor}
            className="text-zinc-400 hover:text-zinc-200 underline transition-colors"
          >
            Reiniciar Anclaje
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
