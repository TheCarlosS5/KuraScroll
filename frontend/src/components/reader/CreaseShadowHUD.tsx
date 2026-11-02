/**
 * KuraScroll - Sprint 96: Bi-Directional Dual-Page Gutters & Crease Shadow Synthesizer HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time bilateral spine crease shadow gradients, gutter width, and volume thickness asymmetry.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  SpreadBindingMode,
  CREASE_SHADOW_PRESETS,
} from '../../reader/useCreaseShadow';

export interface CreaseShadowHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: SpreadBindingMode;
  onModeChange: (mode: SpreadBindingMode) => void;
  spineShadowIntensity: number;
  onIntensityChange: (val: number) => void;
  gutterWidthPx: number;
  onGutterWidthChange: (val: number) => void;
  asymmetryRatio: number;
  onAsymmetryChange: (val: number) => void;
  isRtl: boolean;
  onToggleRtl: () => void;
  progressRatio: number;
  onProgressChange: (val: number) => void;
  leftGutterWidthPx: number;
  rightGutterWidthPx: number;
  leftShadowOpacity: number;
  rightShadowOpacity: number;
  effectiveAsymmetry: number;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const CreaseShadowHUD: React.FC<CreaseShadowHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  spineShadowIntensity,
  onIntensityChange,
  gutterWidthPx,
  onGutterWidthChange,
  asymmetryRatio,
  onAsymmetryChange,
  isRtl,
  onToggleRtl,
  progressRatio,
  onProgressChange,
  leftGutterWidthPx,
  rightGutterWidthPx,
  leftShadowOpacity,
  rightShadowOpacity,
  effectiveAsymmetry,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Dual-Page Crease Shadow HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '360px',
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
              backgroundColor: isEnabled ? '#22c55e' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>
            CREASE SHADOW & GUTTER [C]
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
          }}
        >
          ×
        </button>
      </div>

      {/* Spine Graphic Widget */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Spine Crease Cross-Section</span>
          <span>{isRtl ? 'RTL Manga' : 'LTR Comic'} ({Math.round(progressRatio * 100)}% progress)</span>
        </div>
        <div
          style={{
            display: 'flex',
            height: '24px',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#09090b',
            border: '1px solid #27272a',
          }}
        >
          {/* Left Page Half */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#18181b',
              borderRight: '1px solid #3f3f46',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#71717a',
              fontSize: '10px',
              position: 'relative',
            }}
          >
            <span>Left Page</span>
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: `${leftGutterWidthPx}px`,
                background: `linear-gradient(to left, rgba(0, 0, 0, ${leftShadowOpacity}) 0%, transparent 100%)`,
              }}
            />
          </div>

          {/* Central Spine Fold */}
          <div
            style={{
              width: '2px',
              backgroundColor: '#3b82f6',
            }}
          />

          {/* Right Page Half */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#18181b',
              borderLeft: '1px solid #3f3f46',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#71717a',
              fontSize: '10px',
              position: 'relative',
            }}
          >
            <span>Right Page</span>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${rightGutterWidthPx}px`,
                background: `linear-gradient(to right, rgba(0, 0, 0, ${rightShadowOpacity}) 0%, transparent 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: '#a1a1aa', marginBottom: '6px', fontSize: '11px' }}>
          BINDING PRESET
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {(Object.keys(CREASE_SHADOW_PRESETS) as SpreadBindingMode[]).map((m) => {
            const isSelected = mode === m;
            return (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: isSelected ? '1px solid #3b82f6' : '1px solid #27272a',
                  backgroundColor: isSelected ? '#1e3a8a' : '#27272a',
                  color: isSelected ? '#ffffff' : '#d4d4d8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {m === 'tankobon_tight' ? 'Tankōbon' : m === 'magazine_wide' ? 'Magazine' : m === 'flat_lay' ? 'Flat-Lay' : 'Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Spine Shadow Depth:</span>
            <span>{Math.round(spineShadowIntensity * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label="Spine Shadow Depth"
            min="0.00"
            max="1.00"
            step="0.05"
            value={spineShadowIntensity}
            onChange={(e) => onIntensityChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Gutter Base Width:</span>
            <span>{gutterWidthPx} px</span>
          </div>
          <input
            type="range"
            aria-label="Gutter Base Width"
            min="8"
            max="64"
            step="2"
            value={gutterWidthPx}
            onChange={(e) => onGutterWidthChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Page Block Asymmetry:</span>
            <span>{Math.round(asymmetryRatio * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label="Page Block Asymmetry"
            min="0.00"
            max="1.00"
            step="0.05"
            value={asymmetryRatio}
            onChange={(e) => onAsymmetryChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Volume Progress:</span>
            <span>{Math.round(progressRatio * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label="Volume Progress"
            min="0.00"
            max="1.00"
            step="0.01"
            value={progressRatio}
            onChange={(e) => onProgressChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={isRtl}
            onChange={onToggleRtl}
            style={{ accentColor: '#3b82f6' }}
          />
          RTL (Japanese Manga Right-to-Left)
        </label>
      </div>

      {/* Real-Time Telemetry */}
      <div
        style={{
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '12px',
        }}
      >
        <div style={{ color: '#71717a', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase' }}>
          Spine Telemetry (SLA 60)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Left Gutter</div>
            <div style={{ fontWeight: 600, color: '#60a5fa' }}>{leftGutterWidthPx} px</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Right Gutter</div>
            <div style={{ fontWeight: 600, color: '#34d399' }}>{rightGutterWidthPx} px</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Left Opacity</div>
            <div style={{ fontWeight: 600, color: '#f59e0b' }}>{Math.round(leftShadowOpacity * 100)}%</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Right Opacity</div>
            <div style={{ fontWeight: 600, color: '#f59e0b' }}>{Math.round(rightShadowOpacity * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Global Enable Toggle */}
      <button
        onClick={onToggleEnabled}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #3f3f46',
          backgroundColor: isEnabled ? '#27272a' : '#3f3f46',
          color: isEnabled ? '#f4f4f5' : '#a1a1aa',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        {isEnabled ? 'Disable Crease Engine' : 'Enable Crease Engine'}
      </button>
    </div>
  );
};
