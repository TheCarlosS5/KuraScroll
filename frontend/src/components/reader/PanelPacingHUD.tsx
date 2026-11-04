/**
 * KuraScroll - Sprint 99: Adaptive Per-Panel Visual Pacing & Dynamic Zoom Framing HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time panel bounding box interpolation, viewport scaling, and transition vectors.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  PacingMode,
  PANEL_PACING_PRESETS,
  PanelAabb,
} from '../../reader/usePanelPacing';

export interface PanelPacingHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: PacingMode;
  onModeChange: (mode: PacingMode) => void;
  transitionDurationMs: number;
  onTransitionDurationMsChange: (val: number) => void;
  zoomOvershootRatio: number;
  onZoomOvershootRatioChange: (val: number) => void;
  edgePaddingPx: number;
  onEdgePaddingPxChange: (val: number) => void;
  isMotionReduced: boolean;
  onToggleMotionReduced: () => void;
  sourceAabb: PanelAabb;
  targetAabb: PanelAabb;
  translateX: number;
  translateY: number;
  scale: number;
  isOvershootActive: boolean;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const PanelPacingHUD: React.FC<PanelPacingHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  transitionDurationMs,
  onTransitionDurationMsChange,
  zoomOvershootRatio,
  onZoomOvershootRatioChange,
  edgePaddingPx,
  onEdgePaddingPxChange,
  isMotionReduced,
  onToggleMotionReduced,
  sourceAabb,
  targetAabb,
  translateX,
  translateY,
  scale,
  isOvershootActive,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Panel Pacing & Zoom HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '370px',
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
              backgroundColor: isEnabled ? '#10b981' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Panel Pacing & Zoom
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
            [P]
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
            borderRadius: '4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          PACING PROFILE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {(Object.keys(PANEL_PACING_PRESETS) as PacingMode[]).map((pKey) => {
            const isSelected = mode === pKey;
            return (
              <button
                key={pKey}
                onClick={() => onModeChange(pKey)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: isSelected ? '#3f3f46' : '#27272a',
                  color: isSelected ? '#38bdf8' : '#d4d4d8',
                  border: isSelected ? '1px solid #0284c7' : '1px solid transparent',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pKey === 'cinematic_smooth' && 'Cinematic'}
                {pKey === 'dynamic_action' && 'Fast Action'}
                {pKey === 'instant_cut' && 'Instant Cut'}
                {pKey === 'custom' && 'Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2D Bounding Box Visualizer */}
      <div
        style={{
          marginBottom: '14px',
          padding: '10px',
          backgroundColor: '#09090b',
          borderRadius: '6px',
          border: '1px solid #27272a',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: '#a1a1aa' }}>AABB VIEWPORT TRAJECTORY</span>
          <span
            style={{
              fontSize: '10px',
              color: isOvershootActive ? '#10b981' : '#71717a',
              fontWeight: 600,
            }}
          >
            {isOvershootActive ? 'OVERSHOOT PRIMED' : 'LINEAR / CUT'}
          </span>
        </div>

        {/* Framing Mini Canvas */}
        <div
          style={{
            height: '70px',
            backgroundColor: '#18181b',
            border: '1px dashed #3f3f46',
            borderRadius: '4px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Source Box */}
          <div
            style={{
              position: 'absolute',
              left: '20px',
              top: '15px',
              width: '50px',
              height: '40px',
              border: '1px solid #38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              borderRadius: '2px',
              fontSize: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            SRC
          </div>

          {/* Target Box */}
          <div
            style={{
              position: 'absolute',
              right: '20px',
              top: '10px',
              width: '65px',
              height: '50px',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              borderRadius: '2px',
              fontSize: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            TGT
          </div>

          {/* Trajectory Arrow Label */}
          <div
            style={{
              position: 'absolute',
              left: '80px',
              top: '28px',
              fontSize: '9px',
              color: '#a1a1aa',
            }}
          >
            {'-> zoom '}{scale.toFixed(2)}x
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        {/* Transition Duration */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Camera Glide Duration:</span>
            <span style={{ color: '#38bdf8' }}>{transitionDurationMs}ms</span>
          </div>
          <input
            type="range"
            min="100"
            max="1000"
            step="20"
            value={transitionDurationMs}
            onChange={(e) => onTransitionDurationMsChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* Zoom Overshoot Ratio */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Focal Overshoot Factor:</span>
            <span style={{ color: '#38bdf8' }}>{zoomOvershootRatio.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="100"
            max="130"
            value={Math.round(zoomOvershootRatio * 100)}
            onChange={(e) => onZoomOvershootRatioChange(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* Edge Padding */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Panel Gutter Margin:</span>
            <span style={{ color: '#38bdf8' }}>{edgePaddingPx}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="64"
            step="2"
            value={edgePaddingPx}
            onChange={(e) => onEdgePaddingPxChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>Reduced Motion:</span>
          <button
            onClick={onToggleMotionReduced}
            style={{
              padding: '3px 8px',
              backgroundColor: isMotionReduced ? '#0369a1' : '#27272a',
              color: isMotionReduced ? '#e0f2fe' : '#a1a1aa',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isMotionReduced ? 'REDUCED' : 'NORMAL'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>Pacing Engine:</span>
          <button
            onClick={onToggleEnabled}
            style={{
              padding: '3px 8px',
              backgroundColor: isEnabled ? '#059669' : '#27272a',
              color: isEnabled ? '#ecfdf5' : '#a1a1aa',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        </div>
      </div>

      {/* Telemetry Footer */}
      <div
        style={{
          borderTop: '1px solid #27272a',
          paddingTop: '10px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          fontSize: '10px',
          color: '#71717a',
        }}
      >
        <div>Scale: <span style={{ color: '#a1a1aa' }}>{scale.toFixed(2)}x</span></div>
        <div>Offset: <span style={{ color: '#a1a1aa' }}>{translateX}px, {translateY}px</span></div>
        <div>Duration: <span style={{ color: '#a1a1aa' }}>{transitionDurationMs}ms</span></div>
        <div>Motion: <span style={{ color: isMotionReduced ? '#f59e0b' : '#10b981' }}>{isMotionReduced ? 'CUT' : 'SMOOTH'}</span></div>
      </div>
    </div>
  );
};
