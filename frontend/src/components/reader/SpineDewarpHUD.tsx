/**
 * KuraScroll Smart Page Curvature & Spine Flattening Dewarp HUD
 * Sprint 74 - Tankōbon Gutter Curvature & Shadow Correction
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { GutterSide } from '../../reader/useSpineDewarp';

export interface SpineDewarpHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  gutterSide: GutterSide;
  curvatureDepth: number; // 0.0 - 1.0
  spineWidthPct: number; // 0.05 - 0.50
  shadowCompensation: number; // 0.0 - 0.50
  onToggleEnabled: () => void;
  onChangeGutterSide: (side: GutterSide) => void;
  onChangeCurvatureDepth: (depth: number) => void;
  onChangeSpineWidthPct: (width: number) => void;
  onChangeShadowCompensation: (comp: number) => void;
  onResetToDefaults: () => void;
}

export const SpineDewarpHUD: React.FC<SpineDewarpHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  gutterSide,
  curvatureDepth,
  spineWidthPct,
  shadowCompensation,
  onToggleEnabled,
  onChangeGutterSide,
  onChangeCurvatureDepth,
  onChangeSpineWidthPct,
  onChangeShadowCompensation,
  onResetToDefaults,
}) => {
  // ESC and 'W' key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'w') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const gutterOptions: { id: GutterSide; label: string }[] = [
    { id: 'auto', label: 'Auto (RTL)' },
    { id: 'left', label: 'Izquierda' },
    { id: 'right', label: 'Derecha' },
    { id: 'center', label: 'Centro (Doble)' },
  ];

  return (
    <div
      data-testid="spine-dewarp-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spine-dewarp-title"
    >
      <div
        className="rounded-2xl w-full max-w-sm p-6 text-gray-100 shadow-2xl flex flex-col gap-4 border border-zinc-800"
        style={{
          backgroundColor: '#18181b',
          contain: 'layout paint',
          transform: 'translateZ(0)',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-base" role="img" aria-label="book-spine">📖</span>
            <div>
              <h2 id="spine-dewarp-title" className="text-sm font-bold text-amber-400">
                Aplanador de Lomo Tankōbon (W)
              </h2>
              <p className="text-[11px] text-zinc-400">Corrección de curvatura y sombra de pliegue</p>
            </div>
          </div>
          <button
            data-testid="dewarp-close-btn"
            onClick={onClose}
            className="text-zinc-400 hover:text-white cursor-pointer text-lg leading-none p-1"
            aria-label="Cerrar aplanador"
          >
            ✕
          </button>
        </div>

        {/* Enable / Status Toggle */}
        <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl border border-zinc-800">
          <span className="text-xs font-semibold text-zinc-300">Estado de Corrección</span>
          <button
            data-testid="dewarp-enable-toggle"
            onClick={onToggleEnabled}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isEnabled
                ? 'bg-amber-950/80 border border-amber-600 text-amber-300'
                : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {isEnabled ? 'Activo' : 'Desactivado'}
          </button>
        </div>

        {/* Gutter Side Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-300">Lado del Lomo</label>
          <div className="grid grid-cols-2 gap-1.5">
            {gutterOptions.map((opt) => (
              <button
                key={opt.id}
                data-testid={`gutter-side-${opt.id}`}
                onClick={() => onChangeGutterSide(opt.id)}
                disabled={!isEnabled}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                  gutterSide === opt.id
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Parameter Sliders */}
        <div className="flex flex-col gap-3 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
          {/* Curvature Depth */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Profundidad Curvatura</span>
              <span className="text-amber-400 font-bold">{Math.round(curvatureDepth * 100)}%</span>
            </div>
            <input
              data-testid="curvature-depth-slider"
              type="range"
              min="0"
              max="100"
              value={Math.round(curvatureDepth * 100)}
              onChange={(e) => onChangeCurvatureDepth(Number(e.target.value) / 100)}
              disabled={!isEnabled}
              className="w-full accent-amber-500 cursor-pointer disabled:opacity-30"
              aria-label="Profundidad de curvatura"
            />
          </div>

          {/* Spine Width */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Ancho del Lomo</span>
              <span className="text-amber-400 font-bold">{Math.round(spineWidthPct * 100)}%</span>
            </div>
            <input
              data-testid="spine-width-slider"
              type="range"
              min="5"
              max="50"
              value={Math.round(spineWidthPct * 100)}
              onChange={(e) => onChangeSpineWidthPct(Number(e.target.value) / 100)}
              disabled={!isEnabled}
              className="w-full accent-amber-500 cursor-pointer disabled:opacity-30"
              aria-label="Ancho del lomo"
            />
          </div>

          {/* Shadow Compensation */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Compensación de Sombra</span>
              <span className="text-amber-400 font-bold">{Math.round(shadowCompensation * 100)}%</span>
            </div>
            <input
              data-testid="shadow-compensation-slider"
              type="range"
              min="0"
              max="50"
              value={Math.round(shadowCompensation * 100)}
              onChange={(e) => onChangeShadowCompensation(Number(e.target.value) / 100)}
              disabled={!isEnabled}
              className="w-full accent-amber-500 cursor-pointer disabled:opacity-30"
              aria-label="Compensación de sombra"
            />
          </div>
        </div>

        {/* Reset Button */}
        <button
          data-testid="dewarp-reset-btn"
          onClick={onResetToDefaults}
          className="w-full py-2 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
        >
          Restablecer Valores por Defecto
        </button>
      </div>
    </div>
  );
};
