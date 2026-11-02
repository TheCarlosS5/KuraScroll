/**
 * KuraScroll - Sprint 111: Adaptive Panel Aspect-Ratio Anamorphic Un-Squeeze & Webtoon Seam Stitcher HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time subpixel seam stitching, cumulative origin snapping, and anamorphic panel un-squeezing.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  AnamorphicSeamProfile,
  AnamorphicSeamResult,
  AspectRatioMode,
  SubpixelSnappingMode,
  ANAMORPHIC_SEAM_PRESETS,
} from '../../reader/useAnamorphicSeam';

export interface AnamorphicSeamHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: AnamorphicSeamProfile;
  onProfileChange: (params: Partial<AnamorphicSeamProfile>) => void;
  sampleResult: AnamorphicSeamResult;
  onApplyPreset: (preset: AspectRatioMode) => void;
}

export const AnamorphicSeamHUD: React.FC<AnamorphicSeamHUDProps> = ({
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
      aria-label="Anamorphic Seam HUD"
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
              backgroundColor: profile.isEnabled ? '#38bdf8' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Seam Stitch & Un-Squeeze
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
            SLA 75
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

      {/* Seam Stitching Hologram Radar */}
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
          <span>RATIO: <strong style={{ color: '#38bdf8' }}>{sampleResult.aspectRatioMode}</strong></span>
          <span>FACTOR: <strong>{sampleResult.unsqueezeFactor.toFixed(4)}x</strong></span>
          <span>OVERLAP: <strong>{sampleResult.seamOverlapPx.toFixed(2)}px</strong></span>
        </div>

        {/* Slice Stack Diagram */}
        <div
          style={{
            height: '48px',
            backgroundColor: '#18181b',
            border: '1px dashed #3f3f46',
            borderRadius: '4px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Slice A */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#27272a',
              borderBottom: '1px solid #38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#d4d4d8',
            }}
          >
            Slice N (End: {sampleResult.renderedStartY}px)
          </div>
          {/* Slice B */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#1e293b',
              marginTop: sampleResult.marginBottomCss,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#38bdf8',
            }}
          >
            Slice N+1 (Start: {sampleResult.renderedStartY}px) [Overlapped]
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
          <span>Mode: {profile.subpixelSnappingMode}</span>
          <span>CSS: transform: {sampleResult.transformCss}</span>
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
          <div style={{ color: '#71717a', fontSize: '10px' }}>RAW H</div>
          <div style={{ fontWeight: 600, color: '#fafafa' }}>{sampleResult.rawHeight}px</div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>RENDERED H</div>
          <div style={{ fontWeight: 600, color: '#38bdf8' }}>{sampleResult.renderedHeight}px</div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>SLA 75 LATENCY</div>
          <div style={{ fontWeight: 600, color: '#4ade80' }}>
            {sampleResult.latencyUs.toFixed(2)} µs
          </div>
        </div>
      </div>

      {/* Aspect Ratio Presets */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          ASPECT RATIO PRESETS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '6px',
          }}
        >
          {(Object.keys(ANAMORPHIC_SEAM_PRESETS) as AspectRatioMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onApplyPreset(mode)}
              style={{
                backgroundColor: profile.aspectRatioMode === mode ? '#2563eb' : '#27272a',
                border: 'none',
                borderRadius: '4px',
                color: profile.aspectRatioMode === mode ? '#ffffff' : '#a1a1aa',
                padding: '6px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={ANAMORPHIC_SEAM_PRESETS[mode].description}
            >
              {mode === 'native' ? '1:1 Native' : mode === 'anamorphic_4_3_to_16_9' ? '4:3 to 16:9' : mode === 'anamorphic_4_3_to_16_10' ? '4:3 to 16:10' : 'Custom'}
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
            style={{ accentColor: '#38bdf8' }}
          />
          <span style={{ color: '#fafafa', fontSize: '11px' }}>
            Enable Anamorphic Un-Squeeze & Seam Stitching
          </span>
        </label>

        {/* Un-Squeeze Scale Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Un-Squeeze Scale Factor</span>
            <span style={{ color: '#fafafa' }}>{profile.unsqueezeFactor.toFixed(4)}x</span>
          </div>
          <input
            type="range"
            min={0.70}
            max={1.50}
            step={0.01}
            value={profile.unsqueezeFactor}
            onChange={(e) =>
              onProfileChange({
                unsqueezeFactor: parseFloat(e.target.value),
                aspectRatioMode: 'custom_unsqueeze',
              })
            }
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        {/* Seam Overlap Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Subpixel Seam Overlap</span>
            <span style={{ color: '#fafafa' }}>{profile.seamOverlapPx.toFixed(2)}px</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={2.0}
            step={0.25}
            value={profile.seamOverlapPx}
            onChange={(e) =>
              onProfileChange({
                seamOverlapPx: parseFloat(e.target.value),
              })
            }
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        {/* Snapping Mode Select */}
        <div>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>
            Subpixel Snapping Mode
          </div>
          <select
            value={profile.subpixelSnappingMode}
            onChange={(e) =>
              onProfileChange({
                subpixelSnappingMode: e.target.value as SubpixelSnappingMode,
              })
            }
            style={{
              width: '100%',
              backgroundColor: '#09090b',
              border: '1px solid #27272a',
              borderRadius: '4px',
              color: '#f4f4f5',
              padding: '4px 8px',
              fontSize: '11px',
            }}
          >
            <option value="cumulative_origin">Cumulative Origin (Zero Drift)</option>
            <option value="round">Standard Round</option>
            <option value="floor">Floor (Strict Truncation)</option>
            <option value="ceil">Ceil (Micro Expansion)</option>
          </select>
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
        <span>Toggle shortcut: [U]</span>
        <span>Zero CLS Guaranteed</span>
      </div>
    </div>
  );
};
