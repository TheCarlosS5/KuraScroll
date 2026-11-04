import React from 'react';
import { GovernorState } from '../../utils/frame-pacer';

export interface ThermalGuardHUDProps {
  governorState: GovernorState;
  fps: number;
  dropRatePct: number;
  isManualOverride?: boolean;
  onToggleOverride?: () => void;
  displayMode?: 'full' | 'compact' | 'dot';
}

const STATE_CONFIG: Record<
  GovernorState,
  { label: string; icon: string; textClass: string; bgClass: string; borderClass: string }
> = {
  nominal_60: {
    label: '60 FPS',
    icon: 'NORMAL',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-950/40',
    borderClass: 'border-emerald-500/40',
  },
  paced_30: {
    label: '30 FPS Paced',
    icon: 'WARM',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-950/40',
    borderClass: 'border-amber-500/40',
  },
  emergency_step: {
    label: 'Step Mode',
    icon: 'HOT',
    textClass: 'text-orange-400',
    bgClass: 'bg-orange-950/40',
    borderClass: 'border-orange-500/40',
  },
};

export const ThermalGuardHUD: React.FC<ThermalGuardHUDProps> = ({
  governorState,
  fps,
  dropRatePct,
  isManualOverride = false,
  onToggleOverride,
  displayMode = 'compact',
}) => {
  const cfg = STATE_CONFIG[governorState] || STATE_CONFIG.nominal_60;

  if (displayMode === 'dot') {
    return (
      <span
        data-testid="thermal-guard-dot"
        onClick={onToggleOverride}
        title={`Rendimiento: ${cfg.label} (${fps} FPS · ${dropRatePct}% caídas)`}
        className="w-2.5 h-2.5 rounded-full cursor-pointer transition-colors shadow-sm"
        style={{
          backgroundColor:
            governorState === 'nominal_60' ? '#10b981' :
            governorState === 'paced_30' ? '#f59e0b' : '#f97316',
        }}
      />
    );
  }

  return (
    <aside
      data-testid="thermal-guard-hud"
      onClick={onToggleOverride}
      title="Clic para alternar modo térmico manual (30 FPS vs Automático)"
      className={`fixed top-4 left-24 z-40 select-none cursor-pointer flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900/95 border ${cfg.borderClass} text-neutral-200 text-xs font-semibold rounded-full shadow-lg transition-colors hover:brightness-110`}
      style={{
        contain: 'layout paint',
        minWidth: '110px',
        willChange: 'transform',
      }}
    >
      <span>{cfg.icon}</span>
      <span className={`tabular-nums text-[11px] ${cfg.textClass}`} data-testid="governor-label">
        {displayMode === 'full' ? `${cfg.label} (${Math.round(fps)} FPS)` : cfg.label}
      </span>
      {isManualOverride && (
        <span
          data-testid="manual-override-chip"
          className="px-1 text-[9px] uppercase font-bold tracking-tight rounded bg-neutral-800 text-neutral-400 border border-neutral-700"
          title="Modo forzado por usuario"
        >
          Fix
        </span>
      )}
    </aside>
  );
};
