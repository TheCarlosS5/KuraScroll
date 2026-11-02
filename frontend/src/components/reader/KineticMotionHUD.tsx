/**
 * KuraScroll Kinetic Motion Shutter & Multi-Layer Parallax HUD
 * Sprint 70 - 2.5D Climax Spread Transitions for Manga & Webtoons
 *
 * Hardware-tuned for Intel GMA 4500MHD:
 * Zero CSS blur, zero backdrop-filter, pure solid containment #18181b, CLS = 0.
 */

import React, { useEffect } from 'react';

export type KineticIntensity = 'subtle' | 'normal' | 'intense';

export interface KineticMotionHUDProps {
  isClimaxPanel?: boolean;
  isKineticActive?: boolean;
  isShutterActive?: boolean;
  intensity?: KineticIntensity;
  onToggleKinetic?: () => void;
  onChangeIntensity?: (intensity: KineticIntensity) => void;
  shutterDurationMs?: number;
  className?: string;
}

export const KineticMotionHUD: React.FC<KineticMotionHUDProps> = ({
  isClimaxPanel = true,
  isKineticActive = true,
  isShutterActive = false,
  intensity = 'normal',
  onToggleKinetic,
  onChangeIntensity,
  shutterDurationMs = 250,
  className = '',
}) => {
  // Global keyboard shortcut 'K' or 'k' toggles kinetic mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target?.tagName?.toUpperCase())) return;

      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        onToggleKinetic?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleKinetic]);

  const intensities: { id: KineticIntensity; label: string; offsetPx: number }[] = [
    { id: 'subtle', label: 'Sutil (4px)', offsetPx: 4 },
    { id: 'normal', label: 'Normal (8px)', offsetPx: 8 },
    { id: 'intense', label: 'Intenso (12px)', offsetPx: 12 },
  ];

  return (
    <>
      {/* Cinematic Letterbox Shutter Bars (Zero CSS Blur / 0 CLS) */}
      <div
        data-testid="letterbox-shutter-top"
        className="fixed top-0 left-0 right-0 z-30 pointer-events-none"
        style={{
          height: isShutterActive && isKineticActive ? '10%' : '0px',
          backgroundColor: '#000000',
          transition: `height ${shutterDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          contain: 'strict',
        }}
      />
      <div
        data-testid="letterbox-shutter-bottom"
        className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none"
        style={{
          height: isShutterActive && isKineticActive ? '10%' : '0px',
          backgroundColor: '#000000',
          transition: `height ${shutterDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          contain: 'strict',
        }}
      />

      {/* Climax Control HUD Pill */}
      {isClimaxPanel && (
        <div
          data-testid="kinetic-motion-hud"
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-xl text-xs text-gray-200 select-none shadow-xl ${className}`}
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            contain: 'layout paint',
          }}
          role="region"
          aria-label="Control de Movimiento Cinético y Parallax 2.5D"
        >
          {/* Status Indicator & Toggle */}
          <button
            data-testid="kinetic-toggle-btn"
            onClick={onToggleKinetic}
            className="flex items-center gap-2 cursor-pointer focus:outline-none"
            title="Presiona 'K' para alternar efecto cinético"
            aria-pressed={isKineticActive}
          >
            <span
              data-testid="kinetic-status-dot"
              className={`w-2.5 h-2.5 rounded-full ${
                isKineticActive ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            <span className="font-semibold text-gray-100">
              {isKineticActive ? '2.5D Clímax Activo' : '2.5D Pausado'}
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
              K
            </kbd>
          </button>

          <div className="w-[1px] h-4 bg-zinc-700" />

          {/* Intensity Segmented Selector */}
          <div
            data-testid="intensity-selector"
            className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800"
            role="group"
            aria-label="Selector de intensidad cinética"
          >
            {intensities.map((item) => {
              const active = intensity === item.id;
              return (
                <button
                  key={item.id}
                  data-testid={`intensity-btn-${item.id}`}
                  onClick={() => onChangeIntensity?.(item.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                  aria-pressed={active}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
