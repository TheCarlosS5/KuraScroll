/**
 * KuraScroll - Sprint 110: Perceptual Ambient Chroma Bleed & Color-Temperature Adaptive Edge Backlight HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time perceptual ambient chroma bleed, Planckian Kelvin spectrum, and hardware perimeter gradients.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  ChromaBleedProfile,
  ChromaBleedResult,
  ColorMode,
  CHROMA_BLEED_PRESETS,
} from '../../reader/useChromaBleed';

export interface ChromaBleedHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: ChromaBleedProfile;
  onProfileChange: (params: Partial<ChromaBleedProfile>) => void;
  result: ChromaBleedResult;
  onApplyPreset: (preset: ColorMode) => void;
}

export const ChromaBleedHUD: React.FC<ChromaBleedHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  onApplyPreset,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Chroma Bleed HUD"
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
              backgroundColor: profile.isEnabled ? result.hexColor : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Ambient Chroma Bleed
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
            SLA 74
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

      {/* Chroma Preview Hologram */}
      <div
        style={{
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '12px',
          boxShadow: profile.isEnabled ? result.perimeterShadow : 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#a1a1aa',
          }}
        >
          <span>CHROMA: <strong style={{ color: result.hexColor }}>{result.hexColor}</strong></span>
          <span>LUMINANCE: {result.perceptualLuminance}</span>
          <span>SPREAD: {result.bleedSpreadPx}px</span>
        </div>

        {/* Kelvin Spectrum Bar */}
        <div
          style={{
            marginTop: '8px',
            height: '10px',
            borderRadius: '4px',
            background: 'linear-gradient(to right, #ff4500 0%, #f4ecd8 35%, #ffffff 65%, #00e5ff 100%)',
            position: 'relative',
          }}
        >
          {/* Temperature Marker */}
          <div
            style={{
              position: 'absolute',
              top: '-3px',
              left: `${Math.max(0, Math.min(100, ((profile.colorTemperatureK - 2000) / (9000 - 2000)) * 100))}%`,
              transform: 'translateX(-50%)',
              width: '4px',
              height: '16px',
              backgroundColor: '#fafafa',
              borderRadius: '2px',
              border: '1px solid #000',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: '#71717a',
            marginTop: '4px',
          }}
        >
          <span>2000K (Warm Red)</span>
          <span>6500K (Daylight)</span>
          <span>9000K (Cold Cyan)</span>
        </div>
      </div>

      {/* Telemetry Summary */}
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
          <div style={{ color: '#71717a', fontSize: '10px' }}>TEMP (K)</div>
          <div style={{ fontWeight: 600, color: result.hexColor }}>
            {profile.colorTemperatureK} K
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>INTENSITY</div>
          <div style={{ fontWeight: 600, color: '#fafafa' }}>
            {profile.ambientIntensityPct}%
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

      {/* Presets */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
          AMBIENT PRESETS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {(Object.keys(CHROMA_BLEED_PRESETS) as ColorMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onApplyPreset(mode)}
              style={{
                backgroundColor: profile.colorMode === mode ? '#3f3f46' : '#27272a',
                border: profile.colorMode === mode ? '1px solid #38bdf8' : '1px solid transparent',
                borderRadius: '4px',
                color: profile.colorMode === mode ? '#fafafa' : '#a1a1aa',
                padding: '6px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {CHROMA_BLEED_PRESETS[mode].label.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Controls: Temperature, Spread, Intensity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
            <span>Color Temperature:</span>
            <span style={{ color: '#fafafa' }}>{profile.colorTemperatureK} K</span>
          </div>
          <input
            type="range"
            min="2000"
            max="9000"
            step="100"
            value={profile.colorTemperatureK}
            onChange={(e) => onProfileChange({ colorTemperatureK: Number(e.target.value) })}
            style={{ width: '100%', accentColor: result.hexColor }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
            <span>Bleed Spread Width:</span>
            <span style={{ color: '#fafafa' }}>{profile.bleedSpreadPx} px</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            step="2"
            value={profile.bleedSpreadPx}
            onChange={(e) => onProfileChange({ bleedSpreadPx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
            <span>Ambient Intensity:</span>
            <span style={{ color: '#fafafa' }}>{profile.ambientIntensityPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={profile.ambientIntensityPct}
            onChange={(e) => onProfileChange({ ambientIntensityPct: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>
      </div>

      {/* Toggle Enabled */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #27272a',
          paddingTop: '10px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#71717a' }}>
          HOTKEY: <strong style={{ color: '#fafafa' }}>'Z'</strong>
        </span>

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
          {profile.isEnabled ? 'Active' : 'Muted'}
        </button>
      </div>
    </div>
  );
};
