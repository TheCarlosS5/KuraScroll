/**
 * KuraScroll - Sprint 107: Bi-Temporal Frame-Paced Adaptive Micro-Tile Invalidator & Memory Cache Garbage Collector HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Real-time tile lifecycle matrix, frame budget meter, memory progress bar, and instant micro-purge control.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  TileInvalidationProfile,
  TileInvalidationResult,
  TILE_INVALIDATION_PRESETS,
} from '../../reader/useTileInvalidator';

export interface TileInvalidatorHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: TileInvalidationProfile;
  onProfileChange: (params: Partial<TileInvalidationProfile>) => void;
  result: TileInvalidationResult;
  onApplyPreset: (presetKey: keyof typeof TILE_INVALIDATION_PRESETS) => void;
  onTriggerPurge: () => void;
  isPurging?: boolean;
}

export const TileInvalidatorHUD: React.FC<TileInvalidatorHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  onApplyPreset,
  onTriggerPurge,
  isPurging = false,
}) => {
  if (!isVisible) return null;

  const heapPct = Math.min(100, Math.round((result.totalHeapMb / profile.maxHeapMb) * 100));
  const isHeapWarning = heapPct >= 85;

  return (
    <div
      role="region"
      aria-label="Tile Invalidator HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '390px',
        backgroundColor: '#18181b', // Solid containment for GMA 4500MHD
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
              backgroundColor: isHeapWarning ? '#ef4444' : '#10b981',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Tile Invalidator & GC
          </span>
          <span
            style={{
              fontSize: '10px',
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            SLA 71
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close HUD"
          style={{
            background: 'none',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 6px',
          }}
        >&times;</button>
      </div>

      {/* Memory Progress Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>V8 Heap Ceiling</span>
          <span style={{ color: isHeapWarning ? '#ef4444' : '#38bdf8', fontWeight: 600 }}>
            {result.totalHeapMb.toFixed(1)} / {profile.maxHeapMb.toFixed(0)} MB ({heapPct}%)
          </span>
        </div>
        <div
          style={{
            height: '6px',
            backgroundColor: '#27272a',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${heapPct}%`,
              height: '100%',
              backgroundColor: isHeapWarning ? '#ef4444' : '#10b981',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Visual 2D Tile Strip / Matrix */}
      <div
        style={{
          border: '1px solid #27272a',
          backgroundColor: '#09090b',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Tile Memory Strip ({result.tiles.length} tiles)</span>
          <span style={{ color: '#10b981' }}>Reclaimed: {(result.reclaimedBytes / 1024).toFixed(1)} KB</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: '4px',
            maxHeight: '70px',
            overflowY: 'auto',
          }}
        >
          {result.tiles.map((tile, idx) => {
            let bg = '#10b981'; // ACTIVE_VIEWPORT
            if (tile.retentionClass === 'PRESERVE_WARM') bg = '#38bdf8';
            if (tile.retentionClass === 'EVICT_COOLING') bg = '#f59e0b';
            if (tile.retentionClass === 'EVICT_IMMEDIATE') bg = '#ef4444';

            return (
              <div
                key={tile.id || idx}
                title={`Tile ${tile.id} | Class: ${tile.retentionClass} | Score: ${tile.evictionScore}`}
                style={{
                  height: '14px',
                  backgroundColor: bg,
                  borderRadius: '2px',
                  opacity: 0.85,
                }}
              />
            );
          })}
          {result.tiles.length === 0 && (
            <div style={{ gridColumn: 'span 10', textAlign: 'center', color: '#52525b', fontSize: '11px', padding: '12px 0' }}>
              No active virtual tiles loaded
            </div>
          )}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px' }}>
          <span style={{ color: '#10b981' }}>■ Viewport ({result.activeCount})</span>
          <span style={{ color: '#38bdf8' }}>■ Warm ({result.warmCount})</span>
          <span style={{ color: '#f59e0b' }}>■ Cooling ({result.coolingCount})</span>
          <span style={{ color: '#ef4444' }}>■ Evict ({result.immediateCount})</span>
        </div>
      </div>

      {/* Frame Budget Telemetry */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: '#27272a',
            padding: '8px',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#71717a', fontSize: '10px' }}>Eval Latency</div>
          <div style={{ color: '#10b981', fontWeight: 600, fontSize: '13px' }}>
            {result.evaluationLatencyUs.toFixed(1)} µs
          </div>
          <div style={{ color: '#52525b', fontSize: '9px' }}>SLA Target &lt; 20 µs</div>
        </div>
        <div
          style={{
            backgroundColor: '#27272a',
            padding: '8px',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#71717a', fontSize: '10px' }}>Frame Budget</div>
          <div style={{ color: result.budgetExceeded ? '#ef4444' : '#38bdf8', fontWeight: 600, fontSize: '13px' }}>
            &le; {profile.evictionBudgetMs.toFixed(1)} ms
          </div>
          <div style={{ color: '#52525b', fontSize: '9px' }}>60 FPS Budget Slice</div>
        </div>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#a1a1aa', fontSize: '11px', marginBottom: '4px' }}>Profiles</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(Object.keys(TILE_INVALIDATION_PRESETS) as Array<keyof typeof TILE_INVALIDATION_PRESETS>).map((key) => {
            const isSelected = profile.maxHeapMb === TILE_INVALIDATION_PRESETS[key].maxHeapMb;
            return (
              <button
                key={key}
                onClick={() => onApplyPreset(key)}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  backgroundColor: isSelected ? '#3f3f46' : '#27272a',
                  color: isSelected ? '#fafafa' : '#a1a1aa',
                  border: isSelected ? '1px solid #71717a' : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  textTransform: 'capitalize',
                }}
              >
                {key.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onProfileChange({ isAutoGcEnabled: !profile.isAutoGcEnabled })}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: profile.isAutoGcEnabled ? '#14532d' : '#27272a',
            color: profile.isAutoGcEnabled ? '#86efac' : '#71717a',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          Auto-GC: {profile.isAutoGcEnabled ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={onTriggerPurge}
          disabled={isPurging}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: isPurging ? '#7f1d1d' : '#b91c1c',
            color: '#fef2f2',
            border: 'none',
            borderRadius: '4px',
            cursor: isPurging ? 'wait' : 'pointer',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          {isPurging ? 'Purging...' : 'Instant Purge'}
        </button>
      </div>

      {/* Footer Hotkey Guide */}
      <div
        style={{
          marginTop: '10px',
          textAlign: 'center',
          color: '#52525b',
          fontSize: '10px',
        }}
      >
        Press <kbd style={{ color: '#d4d4d8', backgroundColor: '#27272a', padding: '1px 4px', borderRadius: '2px' }}>T</kbd> to toggle HUD
      </div>
    </div>
  );
};
