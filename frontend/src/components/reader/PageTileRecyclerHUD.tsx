/**
 * KuraScroll - Sprint 101: Bi-Directional Zero-Copy Page Memory Slicing & Ring-Buffer Tile Recycler HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time circular ring buffer slots, zero-copy TypedArray slicing telemetry, and memory footprint.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  SlotRecyclingStrategy,
  PageBufferProfile,
  PageTileRecyclingMatrixResult,
  PAGE_BUFFER_PRESETS,
} from '../../reader/usePageTileRecycler';

export interface PageTileRecyclerHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: PageBufferProfile;
  onProfileChange: (profile: Partial<PageBufferProfile>) => void;
  matrixResult: PageTileRecyclingMatrixResult;
  onApplyPreset: (presetName: string) => void;
  zeroCopyHitCount: number;
}

export const PageTileRecyclerHUD: React.FC<PageTileRecyclerHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  matrixResult,
  onApplyPreset,
  zeroCopyHitCount,
}) => {
  if (!isVisible) return null;

  const usedMemMb = (matrixResult.memoryPoolUsageBytes / (1024 * 1024)).toFixed(1);
  const maxMemMb = (profile.maxMemoryPoolBytes / (1024 * 1024)).toFixed(0);

  const getSlotColor = (state: string, isCurrentRecycled: boolean) => {
    if (isCurrentRecycled) return '#10b981'; // Green for currently recycled slot
    switch (state) {
      case 'active':
        return '#38bdf8'; // Sky blue
      case 'prefetched':
        return '#f59e0b'; // Amber
      case 'evictable':
        return '#ef4444'; // Red
      default:
        return '#71717a'; // Gray
    }
  };

  return (
    <div
      role="region"
      aria-label="Page Tile Recycler HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '380px',
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
              backgroundColor: '#10b981',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Page Buffer & Tile Recycler
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
            SLA 65
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close HUD"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '2px 6px',
            lineHeight: 1,
          }}
        >&times;</button>
      </div>

      {/* Preset Buttons */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          Performance Presets:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {Object.entries(PAGE_BUFFER_PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onApplyPreset(key)}
              style={{
                backgroundColor: profile.ringCapacity === p.ringCapacity ? '#3f3f46' : '#27272a',
                color: profile.ringCapacity === p.ringCapacity ? '#38bdf8' : '#d4d4d8',
                border: profile.ringCapacity === p.ringCapacity ? '1px solid #38bdf8' : '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={p.description}
            >
              {p.label.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Circular Ring Slots Visualizer */}
      <div style={{ marginBottom: '14px', backgroundColor: '#202023', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Ring Slots ({matrixResult.slots.length} Total):</span>
          <span style={{ color: '#10b981' }}>Recycled: Slot #{matrixResult.recycledSlotIndex}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {matrixResult.slots.map(slot => {
            const isRecycled = slot.slotIndex === matrixResult.recycledSlotIndex;
            const color = getSlotColor(slot.state, isRecycled);
            return (
              <div
                key={slot.slotIndex}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  backgroundColor: '#27272a',
                  border: `1px solid ${color}`,
                  borderRadius: '4px',
                  padding: '4px 6px',
                  minWidth: '42px',
                }}
              >
                <span style={{ fontSize: '9px', color: '#a1a1aa' }}>S{slot.slotIndex}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#fafafa' }}>
                  {slot.pageIndex >= 0 ? `P${slot.pageIndex}` : '-'}
                </span>
                <span style={{ fontSize: '8px', color, textTransform: 'uppercase' }}>
                  {isRecycled ? 'RECYCLED' : slot.state}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls & Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="ringCapacity-slider" style={{ color: '#d4d4d8' }}>
              Ring Capacity:
            </label>
            <span style={{ color: '#38bdf8' }}>{profile.ringCapacity} slots</span>
          </div>
          <input
            id="ringCapacity-slider"
            type="range"
            min={3}
            max={15}
            step={1}
            value={profile.ringCapacity}
            onChange={e => onProfileChange({ ringCapacity: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <label htmlFor="forwardLookahead-slider" style={{ color: '#d4d4d8', fontSize: '11px' }}>
                Fwd Look:
              </label>
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>+{profile.forwardLookahead}</span>
            </div>
            <input
              id="forwardLookahead-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={profile.forwardLookahead}
              onChange={e => onProfileChange({ forwardLookahead: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <label htmlFor="backwardLookahead-slider" style={{ color: '#d4d4d8', fontSize: '11px' }}>
                Bwd Look:
              </label>
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>-{profile.backwardLookahead}</span>
            </div>
            <input
              id="backwardLookahead-slider"
              type="range"
              min={0}
              max={5}
              step={1}
              value={profile.backwardLookahead}
              onChange={e => onProfileChange({ backwardLookahead: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
          </div>
        </div>

        {/* Checkbox Zero-Copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <input
            id="zeroCopy-toggle"
            type="checkbox"
            checked={profile.zeroCopySliceEnabled}
            onChange={e => onProfileChange({ zeroCopySliceEnabled: e.target.checked })}
            style={{ accentColor: '#10b981', cursor: 'pointer' }}
          />
          <label htmlFor="zeroCopy-toggle" style={{ color: '#d4d4d8', cursor: 'pointer' }}>
            Zero-Copy TypedArray Subarrays (Spread Slicing)
          </label>
        </div>
      </div>

      {/* Telemetry Footer */}
      <div
        style={{
          borderTop: '1px solid #27272a',
          paddingTop: '8px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          fontSize: '11px',
          color: '#a1a1aa',
        }}
      >
        <div>
          Hit Ratio: <span style={{ color: '#38bdf8' }}>{Math.round(matrixResult.hitRatio * 100)}%</span>
        </div>
        <div>
          RAM: <span style={{ color: '#d4d4d8' }}>{usedMemMb}MB / {maxMemMb}MB</span>
        </div>
        <div>
          Evicted: <span style={{ color: '#ef4444' }}>{matrixResult.evictedPageIndex !== null ? `P${matrixResult.evictedPageIndex}` : 'None'}</span>
        </div>
        <div>
          Zero-Copy Hits: <span style={{ color: '#10b981' }}>{zeroCopyHitCount}</span>
        </div>
      </div>

      <div
        style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#71717a',
          textAlign: 'center',
        }}
      >
        Press [B] to toggle Page Tile Recycler HUD
      </div>
    </div>
  );
};
