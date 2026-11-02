/**
 * KuraScroll - Sprint 86: Continuous Page In-Viewport Micro-Cache HUD Component
 * 
 * Target hardware: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Strictly adheres to 0 blur, solid #18181b background, 0 CLS, and instant keyboard response.
 */

import React from 'react';
import { SlidingWindowMode, SLIDING_WINDOW_CONFIGS } from '../../reader/useSlidingWindow';

export interface SlidingWindowHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: SlidingWindowMode;
  onModeChange: (mode: SlidingWindowMode) => void;
  currentIndex: number;
  startIndex: number;
  endIndex: number;
  totalCount: number;
  activeCount: number;
  prefetchCount: number;
  evictedCount: number;
  estimatedMemoryMB: number;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const SlidingWindowHUD: React.FC<SlidingWindowHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  currentIndex,
  startIndex,
  endIndex,
  totalCount,
  activeCount,
  prefetchCount,
  evictedCount,
  estimatedMemoryMB,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  const currentConfig = SLIDING_WINDOW_CONFIGS[mode];
  const maxQuotaMB = (currentConfig.maxCachedBytes / (1024 * 1024)).toFixed(0);

  return (
    <div
      role="region"
      aria-label="Sliding Window Micro-Cache HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '340px',
        backgroundColor: '#18181b', // Solid containment (no blur/backdrop-filter for GMA 4500MHD)
        border: '1px solid #27272a',
        borderRadius: '8px',
        color: '#f4f4f5',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #27272a',
          paddingBottom: '10px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isEnabled ? '#22c55e' : '#ef4444',
            }}
          />
          <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.02em' }}>
            SLIDING WINDOW CACHE
          </span>
          <span
            style={{
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            [W]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close HUD"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '2px 6px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Mode Selector */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
          BUFFER STRATEGY:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          {(['conservative', 'aggressive', 'preload_heavy'] as SlidingWindowMode[]).map((m) => {
            const isSelected = mode === m;
            return (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                style={{
                  padding: '6px 4px',
                  backgroundColor: isSelected ? '#3f3f46' : '#27272a',
                  color: isSelected ? '#38bdf8' : '#a1a1aa',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: isSelected ? 600 : 400,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                }}
              >
                {m === 'preload_heavy' ? 'Heavy' : m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Telemetry Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          backgroundColor: '#09090b',
          padding: '10px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>CURRENT VIEWPORT</div>
          <div style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
            Page {totalCount > 0 ? currentIndex + 1 : 0} / {totalCount}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>CACHED RANGE</div>
          <div style={{ color: '#38bdf8', fontSize: '13px', fontWeight: 600 }}>
            {totalCount > 0 ? `[${startIndex + 1} - ${endIndex + 1}]` : '[0 - 0]'}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>PREFETCH AHEAD</div>
          <div style={{ color: '#22c55e', fontSize: '12px' }}>
            +{prefetchCount} pages
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>EVICTED NODES</div>
          <div style={{ color: '#f59e0b', fontSize: '12px' }}>
            {evictedCount} pages
          </div>
        </div>
      </div>

      {/* Memory footprint meter */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '11px', marginBottom: '4px' }}>
          <span>Texture VRAM:</span>
          <span>{estimatedMemoryMB} MB / {maxQuotaMB} MB quota</span>
        </div>
        <div style={{ width: '100%', height: '4px', backgroundColor: '#27272a', borderRadius: '2px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, (estimatedMemoryMB / parseFloat(maxQuotaMB)) * 100)}%`,
              height: '100%',
              backgroundColor: estimatedMemoryMB > parseFloat(maxQuotaMB) ? '#ef4444' : '#38bdf8',
            }}
          />
        </div>
      </div>

      {/* Footer Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #27272a' }}>
        <span style={{ color: '#71717a', fontSize: '10px' }}>
          Window: -{currentConfig.backwardBuffer} / +{currentConfig.forwardBuffer}
        </span>
        <button
          onClick={onToggleEnabled}
          style={{
            background: 'none',
            border: 'none',
            color: isEnabled ? '#22c55e' : '#a1a1aa',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 4px',
            textDecoration: 'underline',
          }}
        >
          {isEnabled ? 'Micro-Cache Active' : 'Micro-Cache Paused'}
        </button>
      </div>
    </div>
  );
};
