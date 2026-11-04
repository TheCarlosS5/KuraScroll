/**
 * Sprint 64 - Paper Tone & E-Ink Palette Remapper HUD
 *
 * Provides reactive preset toggles, fine-grained warmth/contrast sliders,
 * and mounts the hardware-accelerated SVG feColorMatrix filter primitive.
 * Optimized for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter, contain: layout paint (CLS = 0).
 */

import React, { useEffect, useCallback } from 'react';
import type { PaperTonePreset } from '../../reader/usePaperTone';

export interface PaperTonePresetOption {
  id: PaperTonePreset;
  label: string;
  sublabel: string;
  badge?: string;
}

export const PAPER_TONE_PRESETS: PaperTonePresetOption[] = [
  { id: 'ORIGINAL', label: 'Original', sublabel: 'sRGB D65 neutral' },
  { id: 'SEPIA_CALIDO', label: 'Sepia Cálido', sublabel: '~3200K cálido' },
  { id: 'PAPEL_E_INK', label: 'Papel E-Ink', sublabel: 'Carta 1200 reflectivo' },
  { id: 'PERIODICO_VINTAGE', label: 'Periódico Vintage', sublabel: 'Prensa marfil tradicional' },
  { id: 'AMBAR_MEDIANOCHE', label: 'Ámbar Medianoche', sublabel: 'Corte 93% luz azul' },
  { id: 'NOIR_ALTO_CONTRASTE', label: 'Noir Alto Contraste', sublabel: 'Monocromo binario' },
];

export interface PaperToneHUDProps {
  isOpen: boolean;
  preset: PaperTonePreset;
  warmth: number;
  contrast: number;
  brightness: number;
  svgMatrix: string;
  isLoading?: boolean;
  onSelectPreset: (preset: PaperTonePreset) => void;
  onChangeWarmth: (val: number) => void;
  onChangeContrast: (val: number) => void;
  onChangeBrightness: (val: number) => void;
  onSave?: () => void;
  onReset?: () => void;
  onClose: () => void;
}

export const PaperToneHUD: React.FC<PaperToneHUDProps> = ({
  isOpen,
  preset,
  warmth,
  contrast,
  brightness,
  svgMatrix,
  isLoading = false,
  onSelectPreset,
  onChangeWarmth,
  onChangeContrast,
  onChangeBrightness,
  onSave,
  onReset,
  onClose,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  return (
    <>
      {/* Global SVG Color Matrix Definition (Always in DOM for GPU compositing) */}
      <svg
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="kura-paper-tone-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={svgMatrix} />
          </filter>
        </defs>
      </svg>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            contain: 'layout paint',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="paper-tone-modal-title"
        >
          <div
            className="rounded-2xl w-full max-w-lg p-6 text-gray-100 shadow-2xl space-y-5"
            style={{
              backgroundColor: '#18181b', // Pure solid background (0 blur for Intel GMA 4500MHD)
              border: '1px solid #27272a',
              contain: 'layout paint',
              transform: 'translateZ(0)',
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h2 id="paper-tone-modal-title" className="text-sm font-bold text-amber-300">
                  Tinte de Papel & Remapeo E-Ink
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 text-sm font-bold"
                aria-label="Cerrar modal"
              >&times;</button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-300">
                Selecciona Modo de Papel / Iluminación:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PAPER_TONE_PRESETS.map((p) => {
                  const isSelected = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectPreset(p.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                        isSelected
                          ? 'bg-amber-950/60 border-amber-500 text-amber-200 ring-1 ring-amber-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-semibold text-zinc-100">{p.label}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{p.sublabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fine-Tuning Sliders */}
            <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
              <div className="text-xs font-semibold text-zinc-300">Calibración Fina:</div>

              {/* Warmth Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Calidez (Balance Rojo/Azul):</span>
                  <span className="font-mono text-zinc-200">
                    {warmth > 0 ? `+${warmth.toFixed(2)}` : warmth.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1.0"
                  max="1.0"
                  step="0.05"
                  value={warmth}
                  onChange={(e) => onChangeWarmth(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  aria-label="Ajustar calidez"
                />
              </div>

              {/* Contrast Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Contraste de Medios Tonos:</span>
                  <span className="font-mono text-zinc-200">{contrast.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={contrast}
                  onChange={(e) => onChangeContrast(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  aria-label="Ajustar contraste"
                />
              </div>

              {/* Brightness Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Luminancia / Brillo:</span>
                  <span className="font-mono text-zinc-200">{(brightness * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={brightness}
                  onChange={(e) => onChangeBrightness(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  aria-label="Ajustar brillo"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={onReset}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
              >
                Restablecer
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Cerrar
                </button>
                {onSave && (
                  <button
                    onClick={onSave}
                    disabled={isLoading}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isLoading ? 'Guardando...' : 'Guardar Perfil'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
