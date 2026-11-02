/**
 * KuraScroll Dynamic Optical Reading Ruler & Saccadic Guided Focus HUD
 * Sprint 71 - Optical Focus & Accessibility Assistance for Manga & Webtoons
 *
 * Hardware-tuned for Intel GMA 4500MHD:
 * Zero CSS blur, zero backdrop-filter, pure solid containment #18181b, CLS = 0.
 * Overlay strictly enforces pointer-events: none to never block user interaction.
 */

import React from 'react';
import {
  OpticalTint,
  RulerMode,
  RulerOrientation,
  TINT_HEX_MAP,
} from '../../reader/useReadingRuler';

export interface ReadingRulerHUDProps {
  isEnabled: boolean;
  mode: RulerMode;
  orientation: RulerOrientation;
  slotSize: number;
  dimOpacity: number;
  tintColor: OpticalTint;
  pacerSpeedWpm: number;
  isPaused: boolean;
  geometry: {
    apertureStart: number;
    apertureEnd: number;
    shutterBeforeSize: number;
    shutterAfterSize: number;
    cssVars: Record<string, string>;
  };
  onToggleVisibility: () => void;
  onChangeMode: (mode: RulerMode) => void;
  onChangeOrientation?: (orientation: RulerOrientation) => void;
  onChangeSlotSize: (size: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onChangeTint: (tint: OpticalTint) => void;
  onChangeSpeedWpm?: (speed: number) => void;
  onTogglePause: () => void;
  className?: string;
}

export const ReadingRulerHUD: React.FC<ReadingRulerHUDProps> = ({
  isEnabled,
  mode,
  orientation,
  slotSize,
  dimOpacity,
  tintColor,
  pacerSpeedWpm,
  isPaused,
  geometry,
  onToggleVisibility,
  onChangeMode,
  onChangeOrientation,
  onChangeSlotSize,
  onChangeOpacity,
  onChangeTint,
  onChangeSpeedWpm,
  onTogglePause,
  className = '',
}) => {
  if (!isEnabled) {
    return null;
  }

  const tints: { id: OpticalTint; label: string; bgClass: string; hex: string }[] = [
    { id: 'amber', label: 'Ámbar', bgClass: 'bg-amber-500', hex: TINT_HEX_MAP.amber },
    { id: 'mint', label: 'Menta', bgClass: 'bg-emerald-500', hex: TINT_HEX_MAP.mint },
    { id: 'rose', label: 'Rosa', bgClass: 'bg-rose-500', hex: TINT_HEX_MAP.rose },
    { id: 'neutral', label: 'Neutro', bgClass: 'bg-zinc-400', hex: TINT_HEX_MAP.neutral },
    { id: 'midnight', label: 'Medianoche', bgClass: 'bg-sky-400', hex: TINT_HEX_MAP.midnight },
  ];

  const currentTintHex = TINT_HEX_MAP[tintColor] || '#ffb74d';
  const isHorizontal = orientation === 'horizontal';

  return (
    <>
      {/* =========================================================================
          1. OPTICAL OVERLAY MASKS (Strict pointer-events: none, 0 CLS, 0 Blur)
          ========================================================================= */}
      {mode === 'shutter' && isHorizontal && (
        <>
          {/* Top Dimmed Shutter */}
          <div
            data-testid="reading-ruler-mask-before"
            className="fixed top-0 left-0 right-0 z-30 pointer-events-none transition-none"
            style={{
              height: `${geometry.shutterBeforeSize}px`,
              backgroundColor: '#000000',
              opacity: dimOpacity,
              pointerEvents: 'none',
              contain: 'strict',
            }}
          />
          {/* Active Aperture Window with Tint Border */}
          <div
            data-testid="reading-ruler-slot"
            className="fixed left-0 right-0 z-30 pointer-events-none transition-none box-border"
            style={{
              top: `${geometry.apertureStart}px`,
              height: `${slotSize}px`,
              borderTop: `1px solid ${currentTintHex}88`,
              borderBottom: `1px solid ${currentTintHex}88`,
              backgroundColor: `${currentTintHex}0a`,
              pointerEvents: 'none',
              contain: 'strict',
            }}
          />
          {/* Bottom Dimmed Shutter */}
          <div
            data-testid="reading-ruler-mask-after"
            className="fixed left-0 right-0 bottom-0 z-30 pointer-events-none transition-none"
            style={{
              top: `${geometry.apertureEnd}px`,
              backgroundColor: '#000000',
              opacity: dimOpacity,
              pointerEvents: 'none',
              contain: 'strict',
            }}
          />
        </>
      )}

      {mode === 'shutter' && !isHorizontal && (
        <>
          {/* Left Dimmed Shutter (Manga RTL) */}
          <div
            data-testid="reading-ruler-mask-before"
            className="fixed top-0 bottom-0 left-0 z-30 pointer-events-none transition-none"
            style={{
              width: `${geometry.shutterBeforeSize}px`,
              backgroundColor: '#000000',
              opacity: dimOpacity,
              pointerEvents: 'none',
              contain: 'strict',
            }}
          />
          {/* Active Aperture Column */}
          <div
            data-testid="reading-ruler-slot"
            className="fixed top-0 bottom-0 z-30 pointer-events-none transition-none box-border"
            style={{
              left: `${geometry.apertureStart}px`,
              width: `${slotSize}px`,
              borderLeft: `1px solid ${currentTintHex}88`,
              borderRight: `1px solid ${currentTintHex}88`,
              backgroundColor: `${currentTintHex}0a`,
              pointerEvents: 'none',
              contain: 'strict',
            }}
          />
          {/* Right Dimmed Shutter */}
          <div
            data-testid="reading-ruler-mask-after"
            className="fixed top-0 bottom-0 right-0 z-30 pointer-events-none transition-none"
            style={{
              left: `${geometry.apertureEnd}px`,
              backgroundColor: '#000000',
              opacity: dimOpacity,
              pointerEvents: 'none',
              contain: 'strict',
            }}
          />
        </>
      )}

      {(mode === 'ruler' || mode === 'saccadic_pacer') && isHorizontal && (
        <div
          data-testid="reading-ruler-slot"
          className="fixed left-0 right-0 z-30 pointer-events-none transition-none box-border"
          style={{
            top: `${geometry.apertureStart}px`,
            height: `${slotSize}px`,
            borderTop: `1px dashed ${currentTintHex}99`,
            borderBottom: `2px solid ${currentTintHex}`,
            backgroundColor: `${currentTintHex}14`,
            pointerEvents: 'none',
            contain: 'strict',
          }}
        />
      )}

      {(mode === 'ruler' || mode === 'saccadic_pacer') && !isHorizontal && (
        <div
          data-testid="reading-ruler-slot"
          className="fixed top-0 bottom-0 z-30 pointer-events-none transition-none box-border"
          style={{
            left: `${geometry.apertureStart}px`,
            width: `${slotSize}px`,
            borderLeft: `1px dashed ${currentTintHex}99`,
            borderRight: `2px solid ${currentTintHex}`,
            backgroundColor: `${currentTintHex}14`,
            pointerEvents: 'none',
            contain: 'strict',
          }}
        />
      )}

      {/* =========================================================================
          2. FLOATING HUD CONTROLS (Pure solid #18181b containment, 0 blur, 0 CLS)
          ========================================================================= */}
      <div
        data-testid="reading-ruler-hud"
        className={`fixed bottom-6 right-6 z-40 flex flex-col gap-3 p-3.5 rounded-xl text-xs text-gray-200 select-none shadow-2xl w-72 ${className}`}
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          contain: 'layout paint',
        }}
        role="region"
        aria-label="Controles de Regla Óptica y Foco Guiado"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: currentTintHex }}
            />
            <span className="font-semibold text-gray-100">Regla Óptica (U)</span>
          </div>
          <button
            data-testid="ruler-close-btn"
            onClick={onToggleVisibility}
            className="text-zinc-400 hover:text-zinc-100 cursor-pointer p-0.5"
            title="Ocultar regla (Tecla U)"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector */}
        <div
          data-testid="mode-selector"
          className="grid grid-cols-3 gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800"
          role="group"
          aria-label="Modo de asistencia óptica"
        >
          {(['ruler', 'shutter', 'saccadic_pacer'] as RulerMode[]).map((m) => {
            const active = mode === m;
            const label = m === 'ruler' ? 'Regla' : m === 'shutter' ? 'Obturador' : 'Pacer';
            return (
              <button
                key={m}
                data-testid={`mode-btn-${m}`}
                onClick={() => onChangeMode(m)}
                className={`py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Orientation & Pacer Controls */}
        <div className="flex items-center justify-between gap-2">
          {onChangeOrientation && (
            <button
              data-testid="orientation-toggle-btn"
              onClick={() => onChangeOrientation(isHorizontal ? 'vertical' : 'horizontal')}
              className="px-2 py-1 text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 cursor-pointer"
            >
              {isHorizontal ? '↔ Horizontal' : '↕ Vertical (Manga)'}
            </button>
          )}

          {mode === 'saccadic_pacer' && (
            <button
              data-testid="pacer-pause-btn"
              onClick={onTogglePause}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded cursor-pointer ${
                isPaused ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {isPaused ? '▶ Reanudar' : '⏸ Pausar [Espacio]'}
            </button>
          )}
        </div>

        {/* Optical Tint Swatches */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-zinc-400 font-medium">Tinte Óptico:</span>
          <div className="flex items-center gap-1.5" role="group" aria-label="Tintes ópticos">
            {tints.map((t) => {
              const active = tintColor === t.id;
              return (
                <button
                  key={t.id}
                  data-testid={`tint-btn-${t.id}`}
                  onClick={() => onChangeTint(t.id)}
                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                    active ? 'ring-2 ring-white scale-125' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: t.hex }}
                  title={`${t.label} (${t.hex})`}
                  aria-pressed={active}
                />
              );
            })}
          </div>
        </div>

        {/* Slot Height Slider */}
        <div className="flex flex-col gap-1 pt-1 border-t border-zinc-800/80">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>{isHorizontal ? 'Altura de ranura' : 'Ancho de columna'}:</span>
            <span className="font-mono text-zinc-200">{slotSize}px</span>
          </div>
          <input
            data-testid="slot-size-slider"
            type="range"
            min="32"
            max="240"
            step="4"
            value={slotSize}
            onChange={(e) => onChangeSlotSize(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
          />
        </div>

        {/* Opacity Slider (Only in shutter mode) */}
        {mode === 'shutter' && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Opacidad de oclusión:</span>
              <span className="font-mono text-zinc-200">{Math.round(dimOpacity * 100)}%</span>
            </div>
            <input
              data-testid="opacity-slider"
              type="range"
              min="0.10"
              max="0.90"
              step="0.05"
              value={dimOpacity}
              onChange={(e) => onChangeOpacity(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
          </div>
        )}

        {/* Pacer Speed Slider (Only in pacer mode) */}
        {mode === 'saccadic_pacer' && onChangeSpeedWpm && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Velocidad de escaneo:</span>
              <span className="font-mono text-zinc-200">{pacerSpeedWpm} WPM</span>
            </div>
            <input
              data-testid="speed-slider"
              type="range"
              min="80"
              max="600"
              step="20"
              value={pacerSpeedWpm}
              onChange={(e) => onChangeSpeedWpm(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
          </div>
        )}
      </div>
    </>
  );
};
