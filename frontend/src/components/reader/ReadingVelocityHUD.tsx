import React, { useState } from 'react';

export type VelocityDisplayMode = 'time_remaining' | 'pages_per_minute' | 'subtle_dot' | 'disabled';

export interface ReadingVelocityHUDProps {
  estimatedMinutes: number;
  estimatedSeconds: number;
  pagesRemaining: number;
  effectiveSecondsPerPage: number;
  isOutlier?: boolean;
  initialMode?: VelocityDisplayMode;
  onModeChange?: (mode: VelocityDisplayMode) => void;
}

export const ReadingVelocityHUD: React.FC<ReadingVelocityHUDProps> = ({
  estimatedMinutes,
  estimatedSeconds,
  pagesRemaining,
  effectiveSecondsPerPage,
  isOutlier = false,
  initialMode = 'time_remaining',
  onModeChange,
}) => {
  const [mode, setMode] = useState<VelocityDisplayMode>(initialMode);

  if (mode === 'disabled') {
    return (
      <button
        type="button"
        onClick={() => {
          setMode('time_remaining');
          onModeChange && onModeChange('time_remaining');
        }}
        data-testid="velocity-hud-restore"
        title="Mostrar velocidad de lectura"
        className="fixed top-4 right-20 z-40 px-2 py-1 bg-neutral-900/90 border border-neutral-700/60 rounded text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors shadow-sm"
      >
        CADENCE
      </button>
    );
  }

  const cycleMode = () => {
    const modes: VelocityDisplayMode[] = ['time_remaining', 'pages_per_minute', 'subtle_dot', 'disabled'];
    const nextIdx = (modes.indexOf(mode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setMode(nextMode);
    onModeChange && onModeChange(nextMode);
  };

  const pagesPerMinute = effectiveSecondsPerPage > 0 ? (60.0 / effectiveSecondsPerPage).toFixed(1) : '2.5';

  return (
    <aside
      data-testid="reading-velocity-hud"
      onClick={cycleMode}
      title="Clic para cambiar modo de visualización de cadencia"
      className="fixed top-4 right-20 z-40 select-none cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/95 border border-neutral-700/60 text-neutral-200 text-xs font-medium rounded-full shadow-lg hover:border-amber-500/50 transition-colors"
      style={{
        contain: 'layout paint',
        minWidth: mode === 'subtle_dot' ? 'auto' : '130px',
        willChange: 'transform',
      }}
    >
      {mode === 'time_remaining' && (
        <>
          <span className="text-amber-400">CADENCE</span>
          <span className="tabular-nums" data-testid="time-remaining-label">
            {pagesRemaining === 0 ? (
              <span className="text-emerald-400 font-bold">Capítulo finalizado</span>
            ) : estimatedMinutes <= 1 ? (
              `~${estimatedSeconds}s restantes`
            ) : (
              `~${estimatedMinutes} min restantes`
            )}
          </span>
          {isOutlier && (
            <span
              data-testid="outlier-indicator"
              title="Pausa detectada (cadencia congelada)"
              className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
            />
          )}
        </>
      )}

      {mode === 'pages_per_minute' && (
        <>
          <span className="text-sky-400 text-xs font-mono">PACE</span>
          <span className="tabular-nums" data-testid="ppm-label">
            {pagesPerMinute} pág/min ({pagesRemaining} restantes)
          </span>
        </>
      )}

      {mode === 'subtle_dot' && (
        <span
          data-testid="subtle-dot"
          className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"
          title={`Cadencia activa: ~${estimatedMinutes}m restantes`}
        />
      )}
    </aside>
  );
};
