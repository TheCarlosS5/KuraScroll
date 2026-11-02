/**
 * KuraScroll - Sprint 87: Progressive Image Decompression & Chunked Bitstream HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays slice layout, idle frame budget, and progressive pass telemetry.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import { ChunkPresetId, CHUNK_PRESETS } from '../../reader/useChunkedBitstream';

export interface ChunkedBitstreamHUDProps {
  isVisible: boolean;
  onClose: () => void;
  preset: ChunkPresetId;
  onPresetChange: (preset: ChunkPresetId) => void;
  totalWidth: number;
  totalHeight: number;
  totalSlices: number;
  idleBudgetMs: number;
  progressivePass: number;
  totalMemoryMB: number;
  isOversized: boolean;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const ChunkedBitstreamHUD: React.FC<ChunkedBitstreamHUDProps> = ({
  isVisible,
  onClose,
  preset,
  onPresetChange,
  totalWidth,
  totalHeight,
  totalSlices,
  idleBudgetMs,
  progressivePass,
  totalMemoryMB,
  isOversized,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Chunked Bitstream Streamer HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        width: '340px',
        backgroundColor: '#18181b', // Solid containment for Intel GMA 4500MHD (no blur/backdrop-filter)
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
            ZERO-JANK STREAMER
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
            [J]
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

      {/* Preset Selector */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
          SLICING PRESET:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          {(['webtoon_conservative', 'low_vram_aggressive', 'high_fidelity'] as ChunkPresetId[]).map((p) => {
            const isSelected = preset === p;
            const label = p === 'webtoon_conservative' ? 'Balanced' : p === 'low_vram_aggressive' ? 'Low VRAM' : 'High-Fi';
            return (
              <button
                key={p}
                onClick={() => onPresetChange(p)}
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
                }}
              >
                {label}
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
          <div style={{ color: '#71717a', fontSize: '10px' }}>IMAGE DIMENSIONS</div>
          <div style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
            {totalWidth} × {totalHeight}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>GPU TILE STATUS</div>
          <div style={{ color: isOversized ? '#f59e0b' : '#22c55e', fontSize: '12px', fontWeight: 600 }}>
            {isOversized ? 'TILED (>2048px)' : 'SINGLE CANVAS'}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>SUB-SLICES</div>
          <div style={{ color: '#38bdf8', fontSize: '13px', fontWeight: 600 }}>
            {totalSlices} tiles
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>FRAME IDLE BUDGET</div>
          <div style={{ color: '#22c55e', fontSize: '12px' }}>
            {idleBudgetMs} ms / frame
          </div>
        </div>
      </div>

      {/* Progressive pass & memory */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '11px', marginBottom: '4px' }}>
          <span>Progressive Pass:</span>
          <span>Pass {progressivePass}/2 (Full Fidelity)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#71717a', fontSize: '10px' }}>
          <span>Estimated RGBA Memory:</span>
          <span>{totalMemoryMB} MB</span>
        </div>
      </div>

      {/* Footer Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #27272a' }}>
        <span style={{ color: '#71717a', fontSize: '10px' }}>
          Max Tile: {CHUNK_PRESETS[preset]?.chunkHeightPx || 1024}px
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
          {isEnabled ? 'Chunking Active' : 'Chunking Paused'}
        </button>
      </div>
    </div>
  );
};
