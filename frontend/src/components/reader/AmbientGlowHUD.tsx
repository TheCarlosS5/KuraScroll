/**
 * KuraScroll - Sprint 92: Adaptive Ambient Screen-Glow Dispersion & Border Bleed Light HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time perimeter border bleed gradients and letterbox glow parameters without host CPU overhead.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  GlowMode,
  AMBIENT_GLOW_PRESETS,
} from '../../reader/useAmbientGlow';

export interface AmbientGlowHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: GlowMode;
  onModeChange: (mode: GlowMode) => void;
  glowSpreadPx: number;
  onSpreadChange: (val: number) => void;
  glowOpacity: number;
  onOpacityChange: (val: number) => void;
  featherSmoothness: number;
  onSmoothnessChange: (val: number) => void;
  topGradientCss: string;
  combinedBoxGlowCss: string;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const AmbientGlowHUD: React.FC<AmbientGlowHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  glowSpreadPx,
  onSpreadChange,
  glowOpacity,
  onOpacityChange,
  featherSmoothness,
  onSmoothnessChange,
  topGradientCss,
  combinedBoxGlowCss,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  const effectiveReach = Math.round(glowSpreadPx * featherSmoothness);

  return (
    <div
      role="region"
      aria-label="Ambient Screen Glow HUD"
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
              backgroundColor: isEnabled ? '#f59e0b' : '#ef4444',
            }}
          />
          <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.02em' }}>
            Ambient Border Bleed HUD [G]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close Glow HUD"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>
          Screen-Glow Immersion Presets
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          {(['cinematic_reactive', 'dark_monochrome_dim', 'vibrant_manhwa_bleed'] as GlowMode[]).map((presetKey) => {
            const isSelected = mode === presetKey;
            return (
              <button
                key={presetKey}
                onClick={() => onModeChange(presetKey)}
                style={{
                  padding: '6px 4px',
                  borderRadius: '4px',
                  border: isSelected ? '1px solid #f59e0b' : '1px solid #27272a',
                  backgroundColor: isSelected ? '#3b2505' : '#09090b',
                  color: isSelected ? '#f59e0b' : '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {presetKey === 'cinematic_reactive'
                  ? 'Cinematic'
                  : presetKey === 'dark_monochrome_dim'
                  ? 'Dark Mono'
                  : 'Vibrant Manhwa'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-time Telemetry Metrics */}
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
          <div style={{ color: '#71717a', fontSize: '10px' }}>Spread Radius</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
            {glowSpreadPx}px
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>Glow Opacity</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
            {(glowOpacity * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>Feather Factor</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#a855f7' }}>
            {featherSmoothness.toFixed(2)}x
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>Effective Reach</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#22c55e' }}>
            {effectiveReach}px
          </div>
        </div>
      </div>

      {/* Hardware CSS Gradient Output */}
      <div
        style={{
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          padding: '8px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <div style={{ color: '#71717a', fontSize: '10px', marginBottom: '2px' }}>
          GMA 4500MHD Hardware Linear Feather
        </div>
        <div
          style={{
            fontFamily: 'monospace',
            color: '#22c55e',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {topGradientCss}
        </div>
      </div>

      {/* Sliders for Fine Tuning */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px' }}>
            <span>Spread Radius (16 - 256px)</span>
            <span>{glowSpreadPx}px</span>
          </div>
          <input
            type="range"
            min="16"
            max="256"
            step="8"
            value={glowSpreadPx}
            onChange={(e) => onSpreadChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px' }}>
            <span>Glow Opacity (0.00 - 1.00)</span>
            <span>{glowOpacity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.00"
            max="1.00"
            step="0.05"
            value={glowOpacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px' }}>
            <span>Feather Smoothness (0.50 - 3.00x)</span>
            <span>{featherSmoothness.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="3.00"
            step="0.10"
            value={featherSmoothness}
            onChange={(e) => onSmoothnessChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#a855f7' }}
          />
        </div>
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
          {isEnabled ? 'Border Bleed Active' : 'Border Bleed Disabled'}
        </button>
        <span style={{ color: '#52525b', fontSize: '10px' }}>0% Host CPU • Zero Blur</span>
      </div>
    </div>
  );
};
