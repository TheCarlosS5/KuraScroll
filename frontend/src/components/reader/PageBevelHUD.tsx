/**
 * KuraScroll - Sprint 109: Bi-Directional Multi-Channel Tactile Page Edge Bevel & Stack Thickness Hologram Synthesizer HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays physical paper stack thickness, center spine sag, and edge bevel gradients.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  PageBevelProfile,
  PageBevelResult,
  PaperCaliperMode,
  BevelReadingDirection,
  PAGE_BEVEL_PRESETS,
} from '../../reader/usePageBevel';

export interface PageBevelHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: PageBevelProfile;
  onProfileChange: (params: Partial<PageBevelProfile>) => void;
  result: PageBevelResult;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onApplyPreset: (preset: PaperCaliperMode) => void;
}

export const PageBevelHUD: React.FC<PageBevelHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  currentPage,
  totalPages,
  onPageChange,
  onApplyPreset,
}) => {
  if (!isVisible) return null;

  const svgW = 340;
  const svgH = 80;
  const spineCenterX = svgW / 2;
  const baseY = 55;

  // Book profile simulation points
  // Left stack height scales with leftThicknessPx, right stack with rightThicknessPx
  const leftH = Math.max(2, result.leftThicknessPx * 1.5);
  const rightH = Math.max(2, result.rightThicknessPx * 1.5);
  const sagY = baseY + Math.min(15, result.sagOffsetPx * 1.2);

  // SVG path for open book cross-section
  const leftEdgeX = 30;
  const rightEdgeX = svgW - 30;
  const bookPath = `M ${leftEdgeX},${baseY - leftH} Q ${spineCenterX - 20},${sagY} ${spineCenterX},${sagY} Q ${spineCenterX + 20},${sagY} ${rightEdgeX},${baseY - rightH} L ${rightEdgeX},${baseY} L ${spineCenterX},${baseY + 4} L ${leftEdgeX},${baseY} Z`;

  return (
    <div
      role="region"
      aria-label="Page Bevel HUD"
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
              backgroundColor: profile.isEnabled ? '#10b981' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Tactile Page Edge Bevel
          </span>
          <span
            style={{
              fontSize: '10px',
              backgroundColor: '#27272a',
              padding: '2px 6px',
              borderRadius: '4px',
              color: '#a1a1aa',
            }}
          >
            SLA 73
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close HUD"
          style={{
            background: 'none',
            border: 'none',
            color: '#71717a',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      {/* Book Cross-Section Hologram SVG */}
      <div
        style={{
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#71717a',
            marginBottom: '4px',
          }}
        >
          <span>LEFT STACK: {result.leftThicknessPx}px ({result.leftPagesCount}p)</span>
          <span>SPINE SAG: {result.sagOffsetPx}px</span>
          <span>RIGHT STACK: {result.rightThicknessPx}px ({result.rightPagesCount}p)</span>
        </div>
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block' }}
        >
          {/* Baseline reference */}
          <line
            x1="20"
            y1={baseY}
            x2={svgW - 20}
            y2={baseY}
            stroke="#27272a"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* Book physical volume body */}
          <path
            d={bookPath}
            fill="#27272a"
            stroke="#a1a1aa"
            strokeWidth="1.5"
          />
          {/* Left stack edge indicator */}
          <line
            x1={leftEdgeX}
            y1={baseY - leftH}
            x2={leftEdgeX}
            y2={baseY}
            stroke="#38bdf8"
            strokeWidth="3"
          />
          {/* Right stack edge indicator */}
          <line
            x1={rightEdgeX}
            y1={baseY - rightH}
            x2={rightEdgeX}
            y2={baseY}
            stroke="#f59e0b"
            strokeWidth="3"
          />
          {/* Spine marker */}
          <circle
            cx={spineCenterX}
            cy={sagY}
            r="3"
            fill="#10b981"
          />
        </svg>
      </div>

      {/* Reading Progress & Direction */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '12px',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>PROGRESS</div>
          <div style={{ fontWeight: 600, color: '#38bdf8' }}>
            {(result.progressRatio * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>DIRECTION</div>
          <div style={{ fontWeight: 600, color: '#fafafa' }}>
            {profile.readingDirection.toUpperCase()}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>LATENCY</div>
          <div style={{ fontWeight: 600, color: '#10b981' }}>
            {result.latencyUs < 1000
              ? `${result.latencyUs.toFixed(1)} µs`
              : `${(result.latencyUs / 1000).toFixed(2)} ms`}
          </div>
        </div>
      </div>

      {/* Caliper Presets */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
          PAPER CALIPER PRESET
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {(Object.keys(PAGE_BEVEL_PRESETS) as PaperCaliperMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onApplyPreset(mode)}
              style={{
                backgroundColor: profile.paperCaliperMode === mode ? '#3f3f46' : '#27272a',
                border: profile.paperCaliperMode === mode ? '1px solid #38bdf8' : '1px solid transparent',
                borderRadius: '4px',
                color: profile.paperCaliperMode === mode ? '#fafafa' : '#a1a1aa',
                padding: '6px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {PAGE_BEVEL_PRESETS[mode].label.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Controls: Stack Thickness & Sag */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
            <span>Max Stack Thickness:</span>
            <span style={{ color: '#fafafa' }}>{profile.maxStackThicknessPx} px</span>
          </div>
          <input
            type="range"
            min="4"
            max="48"
            step="1"
            value={profile.maxStackThicknessPx}
            onChange={(e) => onProfileChange({ maxStackThicknessPx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
            <span>Center Spine Sag:</span>
            <span style={{ color: '#fafafa' }}>{profile.curvatureSagPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={profile.curvatureSagPct}
            onChange={(e) => onProfileChange({ curvatureSagPct: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
            <span>Bevel Edge Shading:</span>
            <span style={{ color: '#fafafa' }}>{profile.edgeBevelShadingPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={profile.edgeBevelShadingPct}
            onChange={(e) => onProfileChange({ edgeBevelShadingPct: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>
      </div>

      {/* Interactive Page Scrubber for Testing Hologram */}
      <div style={{ borderTop: '1px solid #27272a', paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
          <span>Virtual Page Turn:</span>
          <span style={{ color: '#fafafa' }}>Page {currentPage} / {totalPages}</span>
        </div>
        <input
          type="range"
          min="1"
          max={totalPages}
          step="1"
          value={currentPage}
          onChange={(e) => onPageChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#10b981' }}
        />
      </div>

      {/* Direction & Enable Toggles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          borderTop: '1px solid #27272a',
          paddingTop: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['rtl', 'ltr', 'vertical'] as BevelReadingDirection[]).map((dir) => (
            <button
              key={dir}
              onClick={() => onProfileChange({ readingDirection: dir })}
              style={{
                backgroundColor: profile.readingDirection === dir ? '#3f3f46' : '#18181b',
                border: profile.readingDirection === dir ? '1px solid #38bdf8' : '1px solid #27272a',
                color: profile.readingDirection === dir ? '#fafafa' : '#71717a',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              {dir.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={() => onProfileChange({ isEnabled: !profile.isEnabled })}
          style={{
            backgroundColor: profile.isEnabled ? '#065f46' : '#3f3f46',
            color: '#fafafa',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          {profile.isEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>
    </div>
  );
};
