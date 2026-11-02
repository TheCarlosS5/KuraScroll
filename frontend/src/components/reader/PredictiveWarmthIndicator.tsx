/**
 * Sprint 59 - Predictive Warmth Micro-HUD Indicator
 *
 * Micro-HUD designed under Intel GMA 4500MHD hardware constraints:
 * - Solid colors (ZERO CSS blur, ZERO backdrop-filter)
 * - Strict layout containment (contain: layout paint) for CLS = 0
 * - Fixed dimensional footprint (min-width: 88px, height: 24px)
 * - Immediate visual feedback on cache readiness for instant page flips
 */

import React from 'react';
import { WarmthState } from '../../reader/usePrefetchWarmth.js';

export interface PredictiveWarmthIndicatorProps {
  warmth: WarmthState;
  pageNumber?: number;
  compact?: boolean;
  className?: string;
  onRefreshWarmth?: () => void;
}

const WARMTH_CONFIG: Record<
  WarmthState,
  {
    label: string;
    dotColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    ariaText: string;
  }
> = {
  hot: {
    label: 'Ready',
    dotColor: '#22c55e', // Emerald
    textColor: '#86efac',
    bgColor: '#14532d',
    borderColor: '#166534',
    ariaText: 'Página lista en memoria caché',
  },
  warming: {
    label: 'Warming...',
    dotColor: '#eab308', // Amber
    textColor: '#fde047',
    bgColor: '#713f12',
    borderColor: '#854d0e',
    ariaText: 'Precargando página en segundo plano',
  },
  cold: {
    label: 'Cold',
    dotColor: '#64748b', // Slate
    textColor: '#94a3b8',
    bgColor: '#1e293b',
    borderColor: '#334155',
    ariaText: 'Página en disco frío',
  },
};

export const PredictiveWarmthIndicator: React.FC<PredictiveWarmthIndicatorProps> = ({
  warmth,
  pageNumber,
  compact = false,
  className = '',
  onRefreshWarmth,
}) => {
  const config = WARMTH_CONFIG[warmth] || WARMTH_CONFIG.cold;

  return (
    <div
      role="status"
      aria-label={config.ariaText}
      className={`kura-warmth-indicator ${className}`}
      onClick={onRefreshWarmth}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: compact ? '24px' : '88px',
        height: '24px',
        padding: compact ? '2px 6px' : '2px 8px',
        backgroundColor: '#18181b', // Pure solid background, zero blur
        border: `1px solid ${config.borderColor}`,
        borderRadius: '4px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        lineHeight: '18px',
        color: config.textColor,
        cursor: onRefreshWarmth ? 'pointer' : 'default',
        contain: 'layout paint',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {/* State Indicator Dot */}
      <span
        style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.dotColor,
          flexShrink: 0,
          transition: 'background-color 0.15s ease',
        }}
      />

      {/* State Text & Page Context */}
      {!compact && (
        <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
          {pageNumber ? `P.${pageNumber} ` : ''}
          {config.label}
        </span>
      )}
    </div>
  );
};
