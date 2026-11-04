/**
 * Sprint 67 - Dynamic SFX & Onomatopoeia Overlay HUD Component
 *
 * Provides non-destructive comic-styled onomatopoeia translations,
 * interactive CJK phonetic popovers, and display mode toggles.
 * Strictly optimized for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter,
 * contain: layout style paint (CLS = 0).
 */

import React from 'react';
import type {
  SfxMode,
  SfxTargetLanguage,
  SfxPageAnnotation,
} from '../../reader/useSfxOverlay';

export interface SfxOverlayHUDProps {
  isVisible: boolean;
  mode: SfxMode;
  targetLanguage: SfxTargetLanguage;
  annotations: SfxPageAnnotation[];
  selectedAnnotation: SfxPageAnnotation | null;
  pageWidth?: number;
  pageHeight?: number;
  onToggleVisibility: () => void;
  onSelectMode: (mode: SfxMode) => void;
  onSelectLanguage: (lang: SfxTargetLanguage) => void;
  onSelectAnnotation: (ann: SfxPageAnnotation | null) => void;
}

export const SfxOverlayHUD: React.FC<SfxOverlayHUDProps> = ({
  isVisible,
  mode,
  targetLanguage,
  annotations,
  selectedAnnotation,
  pageWidth = 1000,
  pageHeight = 1500,
  onToggleVisibility,
  onSelectMode,
  onSelectLanguage,
  onSelectAnnotation,
}) => {
  return (
    <>
      {/* Floating Mode Toggle Bar */}
      <div
        role="region"
        aria-label="Panel de Control de Onomatopeyas SFX"
        data-testid="sfx-hud-controls"
        className="fixed top-4 right-4 z-40 flex items-center gap-2 bg-zinc-900 border border-zinc-700 p-2 rounded shadow-xl text-xs font-mono select-none"
        style={{ contain: 'layout style paint' }}
      >
        <button
          type="button"
          data-testid="sfx-toggle-btn"
          aria-label="Alternar Visibilidad SFX (Tecla S)"
          onClick={onToggleVisibility}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold cursor-pointer transition-colors ${
            isVisible
              ? 'bg-amber-950/60 border-amber-500/80 text-amber-300'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>SFX</span>
          <span className="text-[9px] px-1 bg-zinc-950 text-zinc-400 rounded border border-zinc-700">S</span>
        </button>

        {isVisible && (
          <>
            {/* Mode Selector */}
            <div className="flex bg-zinc-950 border border-zinc-800 rounded p-0.5" data-testid="sfx-mode-selector">
              <button
                type="button"
                data-testid="sfx-mode-overlay-btn"
                onClick={() => onSelectMode('TRANSLATED_OVERLAY')}
                className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                  mode === 'TRANSLATED_OVERLAY'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Subtítulos
              </button>
              <button
                type="button"
                data-testid="sfx-mode-tooltip-btn"
                onClick={() => onSelectMode('INTERACTIVE_TOOLTIP')}
                className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                  mode === 'INTERACTIVE_TOOLTIP'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Táctil
              </button>
              <button
                type="button"
                data-testid="sfx-mode-original-btn"
                onClick={() => onSelectMode('ORIGINAL_ONLY')}
                className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                  mode === 'ORIGINAL_ONLY'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Original
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex bg-zinc-950 border border-zinc-800 rounded p-0.5" data-testid="sfx-lang-selector">
              <button
                type="button"
                data-testid="sfx-lang-es-btn"
                onClick={() => onSelectLanguage('es')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  targetLanguage === 'es' ? 'bg-amber-600 text-white font-bold' : 'text-zinc-400'
                }`}
              >
                ES
              </button>
              <button
                type="button"
                data-testid="sfx-lang-en-btn"
                onClick={() => onSelectLanguage('en')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  targetLanguage === 'en' ? 'bg-amber-600 text-white font-bold' : 'text-zinc-400'
                }`}
              >
                EN
              </button>
            </div>

            <span className="text-[10px] text-zinc-500 font-mono" data-testid="sfx-count-badge">
              {annotations.length} SFX
            </span>
          </>
        )}
      </div>

      {/* SVG Translation Layer */}
      {isVisible && mode !== 'ORIGINAL_ONLY' && annotations.length > 0 && (
        <svg
          data-testid="sfx-svg-layer"
          aria-hidden="true"
          viewBox={`0 0 ${pageWidth} ${pageHeight}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ contain: 'layout style paint' }}
        >
          {annotations.map((ann) => {
            const x = (ann.normX + ann.normW / 2) * pageWidth;
            const y = (ann.normY + ann.normH / 2) * pageHeight;
            const fontSize = Math.max(14, ann.normH * pageHeight * 0.35);
            const translation = ann.displayTranslation || ann.sfx?.translationEs || '';

            return (
              <g
                key={ann.id}
                data-testid={`sfx-item-${ann.id}`}
                className="pointer-events-auto cursor-pointer"
                onClick={() => onSelectAnnotation(ann)}
              >
                {/* Touch/Click Target */}
                <rect
                  x={ann.normX * pageWidth}
                  y={ann.normY * pageHeight}
                  width={ann.normW * pageWidth}
                  height={ann.normH * pageHeight}
                  fill={mode === 'INTERACTIVE_TOOLTIP' ? 'rgba(245, 158, 11, 0.15)' : 'transparent'}
                  stroke={mode === 'INTERACTIVE_TOOLTIP' ? '#f59e0b' : 'transparent'}
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />

                {/* Translated Typography */}
                {mode === 'TRANSLATED_OVERLAY' && (
                  <text
                    x={x}
                    y={y}
                    fill="#ffffff"
                    stroke="#111111"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                    fontSize={fontSize}
                    fontWeight="900"
                    fontFamily="Arial Black, Impact, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${ann.rotationDeg} ${x} ${y})`}
                  >
                    {translation}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Interactive Tooltip Card */}
      {selectedAnnotation && (
        <div
          role="dialog"
          aria-label="Detalle de Onomatopeya"
          data-testid="sfx-detail-popover"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-80 bg-zinc-900 border border-amber-500/80 rounded-lg shadow-2xl p-3 text-zinc-200 select-none"
          style={{ contain: 'layout style paint' }}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-amber-400 font-sans">
                {selectedAnnotation.sfx?.surface}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                ({selectedAnnotation.sfx?.romanization})
              </span>
            </div>
            <button
              type="button"
              data-testid="sfx-popover-close-btn"
              onClick={() => onSelectAnnotation(null)}
              className="text-zinc-400 hover:text-zinc-100 px-1 text-sm font-mono leading-none"
             aria-label="Cerrar">&times;</button>
          </div>

          <div className="mt-2 space-y-1 font-sans text-xs">
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-700/60 rounded uppercase">
                {selectedAnnotation.sfx?.category}
              </span>
              <span className="text-zinc-400">
                Idioma: {selectedAnnotation.sfx?.languageCode === 'ja' ? 'Japonés' : 'Coreano'}
              </span>
            </div>

            <p className="text-zinc-300 pt-1" data-testid="sfx-meaning-text">
              {targetLanguage === 'en'
                ? selectedAnnotation.sfx?.meaningEn
                : selectedAnnotation.sfx?.meaningEs}
            </p>

            <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80 text-[11px] font-mono">
              <span className="text-zinc-500">TRADUCCIÓN:</span>
              <span className="text-amber-400 font-bold text-xs" data-testid="sfx-translation-text">
                {selectedAnnotation.displayTranslation || selectedAnnotation.sfx?.translationEs}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
