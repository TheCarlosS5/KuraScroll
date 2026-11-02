/**
 * KuraScroll - Sprint 113: Subpixel Micro-Vector Glyph Sharpener & Anti-Aliasing Edge Contrast Enhancer HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time CJK glyph sharpening, inverse stroke protection, and hardware contrast modulation.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  GlyphSharpenerProfile,
  GlyphSharpenerResult,
  SharpenerMode,
  GLYPH_SHARPENER_PRESETS,
} from '../../reader/useGlyphSharpener';

export interface GlyphSharpenerHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: GlyphSharpenerProfile;
  onProfileChange: (params: Partial<GlyphSharpenerProfile>) => void;
  sampleResult: GlyphSharpenerResult;
  onApplyPreset: (preset: SharpenerMode) => void;
}

export const GlyphSharpenerHUD: React.FC<GlyphSharpenerHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  sampleResult,
  onApplyPreset,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Glyph Sharpener HUD"
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
              backgroundColor: profile.isEnabled ? '#f59e0b' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Kanji Glyph Sharpener
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
            SLA 77
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

      {/* Glyph Sharpening Visual Preview */}
      <div
        style={{
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '12px',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#a1a1aa',
            marginBottom: '8px',
          }}
        >
          <span>MODE: <strong style={{ color: '#f59e0b' }}>{sampleResult.sharpenerMode}</strong></span>
          <span>CONTRAST: <strong>{sampleResult.effectiveContrast.toFixed(3)}x</strong></span>
          <span>PROTECTION: <strong>{(sampleResult.strokeProtectionFactor * 100).toFixed(0)}%</strong></span>
        </div>

        {/* Kanji & Ruby Preview Display */}
        <div
          style={{
            height: '56px',
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            filter: sampleResult.cssFilter,
            padding: '4px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#a1a1aa' }}>うつ</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fafafa' }}>鬱</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#a1a1aa' }}>りゅう</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>龍</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#a1a1aa' }}>ぎ</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>議</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: '#71717a',
            marginTop: '6px',
          }}
        >
          <span>Rendering: {sampleResult.textRendering}</span>
          <span>CSS: filter: {sampleResult.cssFilter}</span>
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
          <div style={{ color: '#71717a', fontSize: '10px' }}>EFF CONTRAST</div>
          <div style={{ fontWeight: 600, color: '#fafafa' }}>
            {sampleResult.effectiveContrast.toFixed(3)}x
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>GAMMA ADAPT</div>
          <div style={{ fontWeight: 600, color: '#f59e0b' }}>
            {sampleResult.effectiveBrightness.toFixed(3)}x
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>SLA 77 LATENCY</div>
          <div style={{ fontWeight: 600, color: '#4ade80' }}>
            {sampleResult.latencyUs.toFixed(2)} µs
          </div>
        </div>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          TYPOGRAPHIC PRESETS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '6px',
          }}
        >
          {(Object.keys(GLYPH_SHARPENER_PRESETS) as SharpenerMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onApplyPreset(mode)}
              style={{
                backgroundColor: profile.sharpenerMode === mode ? '#d97706' : '#27272a',
                border: 'none',
                borderRadius: '4px',
                color: profile.sharpenerMode === mode ? '#ffffff' : '#a1a1aa',
                padding: '6px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={GLYPH_SHARPENER_PRESETS[mode].description}
            >
              {mode === 'adaptive_kanji' ? 'Adaptive Kanji' : mode === 'high_contrast_furigana' ? 'Ruby Furigana' : mode === 'kana_light' ? 'Kana Soft' : mode === 'dense_cjk_compaction' ? 'Dense Anti-Fill' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders and Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Enable / Disable */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={profile.isEnabled}
            onChange={(e) => onProfileChange({ isEnabled: e.target.checked })}
            style={{ accentColor: '#f59e0b' }}
          />
          <span style={{ color: '#fafafa', fontSize: '11px' }}>
            Enable Subpixel Micro-Vector Sharpening
          </span>
        </label>

        {/* Contrast Multiplier Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Contrast Boost Multiplier</span>
            <span style={{ color: '#fafafa' }}>{profile.contrastMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={1.0}
            max={1.5}
            step={0.05}
            value={profile.contrastMultiplier}
            onChange={(e) =>
              onProfileChange({
                contrastMultiplier: parseFloat(e.target.value),
                sharpenerMode: 'custom_matrix',
              })
            }
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
        </div>

        {/* Stroke Protection Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Dense Stroke Anti-Fill Protection</span>
            <span style={{ color: '#fafafa' }}>{profile.strokeProtectionPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={profile.strokeProtectionPct}
            onChange={(e) =>
              onProfileChange({
                strokeProtectionPct: parseInt(e.target.value, 10),
              })
            }
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          borderTop: '1px solid #27272a',
          marginTop: '12px',
          paddingTop: '8px',
          fontSize: '10px',
          color: '#71717a',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Toggle shortcut: [K]</span>
        <span>Anti-Fill-In Gated</span>
      </div>
    </div>
  );
};
