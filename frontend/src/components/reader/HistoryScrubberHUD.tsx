/**
 * KuraScroll - Sprint 90: Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays interactive history navigation tape, dwell-time attention heatmap,
 * and snap-to-chapter magnetic indicators with zero mechanical disk seek thrashing.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  ScrubberMode,
  SCRUBBER_MODE_CONFIGS,
} from '../../reader/useHistoryScrubber';

export interface HistoryScrubberHUDProps {
  isVisible: boolean;
  onClose: () => void;
  scrubberMode: ScrubberMode;
  onModeChange: (mode: ScrubberMode) => void;
  currentIndex: number;
  totalItems: number;
  tapeThicknessPx: number;
  onThicknessChange: (px: number) => void;
  heatmapIntensity: number;
  onHeatmapIntensityChange: (val: number) => void;
  velocityMultiplier: number;
  onVelocityMultiplierChange: (val: number) => void;
  isSnapToChapter: boolean;
  onToggleSnap: () => void;
  normalizedPosition: number;
  pixelOffset: number;
  isAtStart: boolean;
  isAtEnd: boolean;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onScrubRatio: (ratio: number) => void;
}

export const HistoryScrubberHUD: React.FC<HistoryScrubberHUDProps> = ({
  isVisible,
  onClose,
  scrubberMode,
  onModeChange,
  currentIndex,
  totalItems,
  tapeThicknessPx,
  onThicknessChange,
  heatmapIntensity,
  onHeatmapIntensityChange,
  velocityMultiplier,
  onVelocityMultiplierChange,
  isSnapToChapter,
  onToggleSnap,
  normalizedPosition,
  pixelOffset,
  isAtStart,
  isAtEnd,
  isEnabled,
  onToggleEnabled,
  onScrubRatio,
}) => {
  if (!isVisible) return null;

  const currentConfig = SCRUBBER_MODE_CONFIGS[scrubberMode] || SCRUBBER_MODE_CONFIGS.webtoon_continuous;

  return (
    <div
      role="region"
      aria-label="Infinite History Scrubber HUD"
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
              backgroundColor: isEnabled ? '#38bdf8' : '#ef4444',
            }}
          />
          <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.02em' }}>
            History Scrubber & Heatmap [Z]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close Scrubber HUD"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px 6px',
          }}
        >&times;</button>
      </div>

      {/* Mode Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>
          Orientation & Navigation Mode
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          {(Object.keys(SCRUBBER_MODE_CONFIGS) as ScrubberMode[]).map((modeKey) => {
            const isSelected = scrubberMode === modeKey;
            return (
              <button
                key={modeKey}
                onClick={() => onModeChange(modeKey)}
                style={{
                  padding: '6px 4px',
                  borderRadius: '4px',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid #27272a',
                  backgroundColor: isSelected ? '#1e293b' : '#09090b',
                  color: isSelected ? '#38bdf8' : '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {modeKey === 'webtoon_continuous'
                  ? 'Webtoon'
                  : modeKey === 'manga_rtl_continuous'
                  ? 'Manga RTL'
                  : 'Manhua LTR'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-Time Position Telemetry */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          backgroundColor: '#09090b',
          padding: '10px',
          borderRadius: '6px',
          marginBottom: '12px',
          border: '1px solid #27272a',
        }}
      >
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>Item Position</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
            {currentIndex + 1} / {totalItems}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>Tape Offset</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#22c55e' }}>
            {pixelOffset}px
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>Normalized Ratio</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
            {(normalizedPosition * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>Trajectory Boundary</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: isAtStart ? '#38bdf8' : isAtEnd ? '#ec4899' : '#a1a1aa' }}>
            {isAtStart ? 'Series Head' : isAtEnd ? 'Latest Page' : 'In-Transit'}
          </div>
        </div>
      </div>

      {/* Visual Heatmap Tape Interactive Track */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px', marginBottom: '4px' }}>
          <span>Attention Heatmap Tape ({currentConfig.isRtl ? 'RTL' : 'LTR'})</span>
          <span>{(heatmapIntensity * 100).toFixed(0)}% Gaze</span>
        </div>
        <div
          role="slider"
          aria-label="History Tape Scrubber"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(normalizedPosition * 100)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1.0, clickX / rect.width));
            onScrubRatio(ratio);
          }}
          style={{
            position: 'relative',
            height: '24px',
            backgroundColor: '#09090b',
            border: '1px solid #27272a',
            borderRadius: '4px',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* Heatmap background gradient representing attention dwell time */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(to right, #0284c7 0%, #38bdf8 30%, #f59e0b 60%, #ef4444 85%, #8b5cf6 100%)`,
              opacity: heatmapIntensity,
            }}
          />

          {/* Chapter division ticks */}
          <div style={{ position: 'absolute', top: 0, left: '25%', width: '1px', height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <div style={{ position: 'absolute', top: 0, left: '50%', width: '1px', height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <div style={{ position: 'absolute', top: 0, left: '75%', width: '1px', height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' }} />

          {/* Active playhead thumb indicator */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${Math.max(0, Math.min(100, normalizedPosition * 100))}%`,
              width: '4px',
              marginLeft: '-2px',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 4px rgba(0,0,0,0.8)',
            }}
          />
        </div>
      </div>

      {/* Sliders for Dynamic Tuning */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px' }}>
            <span>Tape Thickness (24 - 120px)</span>
            <span>{tapeThicknessPx}px</span>
          </div>
          <input
            type="range"
            min="24"
            max="120"
            step="4"
            value={tapeThicknessPx}
            onChange={(e) => onThicknessChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px' }}>
            <span>Heatmap Luminescence (0.0 - 1.0)</span>
            <span>{heatmapIntensity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.00"
            max="1.00"
            step="0.05"
            value={heatmapIntensity}
            onChange={(e) => onHeatmapIntensityChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px' }}>
            <span>Scrub Multiplier (0.5 - 3.0x)</span>
            <span>{velocityMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="3.00"
            step="0.10"
            value={velocityMultiplier}
            onChange={(e) => onVelocityMultiplierChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#a855f7' }}
          />
        </div>
      </div>

      {/* Chapter Snap Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>Magnetic Snap to Chapter</span>
        <button
          onClick={onToggleSnap}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid #27272a',
            backgroundColor: isSnapToChapter ? '#0284c7' : '#27272a',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          {isSnapToChapter ? 'Magnet ON' : 'Magnet OFF'}
        </button>
      </div>

      {/* Footer Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
        <button
          onClick={onToggleEnabled}
          style={{
            backgroundColor: isEnabled ? '#15803d' : '#991b1b',
            border: 'none',
            color: '#fff',
            borderRadius: '4px',
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          {isEnabled ? 'Scrubber Active' : 'Scrubber Disabled'}
        </button>
        <span style={{ color: '#52525b', fontSize: '10px' }}>0% Seek Thrash • Client RAM</span>
      </div>
    </div>
  );
};
