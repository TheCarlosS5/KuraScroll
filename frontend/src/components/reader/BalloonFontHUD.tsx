/**
 * KuraScroll - Sprint 106: Adaptive Viewport Spatial Dialogue Balloon Glyph & Text Auto-Scaler HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time speech balloon font auto-scaling, furigana clearance, and density telemetry.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  FontScalingMode,
  BalloonFontProfile,
  BalloonFontScaleResult,
  BALLOON_FONT_PRESETS,
} from '../../reader/useBalloonFont';

export interface BalloonFontHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: BalloonFontProfile;
  onProfileChange: (profile: Partial<BalloonFontProfile>) => void;
  result: BalloonFontScaleResult;
  onApplyPreset: (mode: FontScalingMode) => void;
}

export const BalloonFontHUD: React.FC<BalloonFontHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  onApplyPreset,
}) => {
  if (!isVisible) return null;

  const svgW = 340;
  const svgH = 110;
  const previewFontSize = Math.min(22, Math.max(10, result.optimalFontSizePx * 0.8));
  const rubyFontSize = Math.round(previewFontSize * 0.5);

  return (
    <div
      role="region"
      aria-label="Balloon Font HUD"
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
              backgroundColor: result.isOverflowSafe ? '#10b981' : '#f59e0b',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Balloon Font Auto-Scaler
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
            SLA 70
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
        >
          ✕
        </button>
      </div>

      {/* Preset Buttons */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          Typography Scaling Presets:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {Object.entries(BALLOON_FONT_PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onApplyPreset(key as FontScalingMode)}
              style={{
                backgroundColor: profile.scalingMode === key ? '#3f3f46' : '#27272a',
                color: profile.scalingMode === key ? '#38bdf8' : '#d4d4d8',
                border: profile.scalingMode === key ? '1px solid #38bdf8' : '1px solid #3f3f46',
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

      {/* 2D Speech Balloon SVG Preview Visualizer */}
      <div style={{ marginBottom: '14px', backgroundColor: '#202023', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Optical Glyphs:</span>
          <span style={{ color: '#38bdf8' }}>
            {result.optimalFontSizePx}px ({result.scaleRatio}x)
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: `${svgH}px`,
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`}>
            {/* Manga speech balloon bubble */}
            <path
              d="M 30,15 Q 170,8 310,15 Q 325,50 310,85 Q 260,95 210,90 L 195,105 L 190,90 Q 70,95 30,85 Q 15,50 30,15 Z"
              fill="#27272a"
              stroke="#38bdf8"
              strokeWidth={1.5}
            />
            {/* Furigana ruby line if enabled */}
            {profile.isFuriganaPreserved && (
              <text
                x={svgW * 0.5}
                y={36}
                textAnchor="middle"
                fill="#f59e0b"
                fontSize={rubyFontSize}
                fontFamily="sans-serif"
              >
                ふりがな
              </text>
            )}
            {/* Scaled dialogue text */}
            <text
              x={svgW * 0.5}
              y={profile.isFuriganaPreserved ? 60 : 54}
              textAnchor="middle"
              fill="#fafafa"
              fontSize={previewFontSize}
              fontWeight={600}
              fontFamily="sans-serif"
            >
              読む • KuraScroll KS
            </text>
          </svg>
        </div>
      </div>

      {/* Controls & Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="minFontSize-slider" style={{ color: '#d4d4d8' }}>
              Minimum Legible Size:
            </label>
            <span style={{ color: '#38bdf8' }}>{profile.minFontSizePx}px</span>
          </div>
          <input
            id="minFontSize-slider"
            type="range"
            min={6}
            max={24}
            step={1}
            value={profile.minFontSizePx}
            onChange={e => onProfileChange({ minFontSizePx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="maxFontSize-slider" style={{ color: '#d4d4d8' }}>
              Maximum Optical Size:
            </label>
            <span style={{ color: '#38bdf8' }}>{profile.maxFontSizePx}px</span>
          </div>
          <input
            id="maxFontSize-slider"
            type="range"
            min={16}
            max={72}
            step={2}
            value={profile.maxFontSizePx}
            onChange={e => onProfileChange({ maxFontSizePx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="densityRatio-slider" style={{ color: '#d4d4d8' }}>
              Target Bubble Fill:
            </label>
            <span style={{ color: '#10b981' }}>{Math.round(profile.targetDensityRatio * 100)}%</span>
          </div>
          <input
            id="densityRatio-slider"
            type="range"
            min={20}
            max={95}
            step={5}
            value={Math.round(profile.targetDensityRatio * 100)}
            onChange={e => onProfileChange({ targetDensityRatio: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
        </div>

        {/* Furigana toggle checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <input
            id="furigana-toggle"
            type="checkbox"
            checked={profile.isFuriganaPreserved}
            onChange={e => onProfileChange({ isFuriganaPreserved: e.target.checked })}
            style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
          />
          <label htmlFor="furigana-toggle" style={{ color: '#d4d4d8', cursor: 'pointer', fontSize: '11px' }}>
            Preserve Ruby Furigana Clearance
          </label>
        </div>
      </div>

      {/* Real-Time Telemetry Bar */}
      <div
        style={{
          borderTop: '1px solid #27272a',
          paddingTop: '10px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          fontSize: '10px',
          color: '#a1a1aa',
        }}
      >
        <div>
          Font: <span style={{ color: '#38bdf8' }}>{result.optimalFontSizePx}px</span>
        </div>
        <div>
          Capacity: <span style={{ color: '#10b981' }}>{result.maxCharsEstimate} chars</span>
        </div>
        <div>
          Furigana: <span style={{ color: result.isFuriganaSafe ? '#f59e0b' : '#71717a' }}>{result.isFuriganaSafe ? 'PROTECTED' : 'COLLAPSED'}</span>
        </div>
        <div>
          Latency: <span style={{ color: '#10b981' }}>{result.latencyUs < 1 ? '< 1 µs' : `${result.latencyUs.toFixed(1)} µs`}</span>
        </div>
      </div>

      {/* Tip footer */}
      <div style={{ marginTop: '10px', fontSize: '9px', color: '#71717a', textAlign: 'center' }}>
        Press <kbd style={{ backgroundColor: '#27272a', padding: '1px 4px', borderRadius: '2px', color: '#e4e4e7' }}>F</kbd> to toggle HUD
      </div>
    </div>
  );
};
