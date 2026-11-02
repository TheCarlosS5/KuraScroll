/**
 * KuraScroll - Sprint 104: Adaptive Per-Panel Reading Gaze Anchor & Eye-Rest Aperture Shutter HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time aperture focal mask SVG, circadian warmth telemetry, and rest intervals.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  ShutterMode,
  EyeRestProfile,
  EyeRestApertureResult,
  EYE_REST_PRESETS,
} from '../../reader/useEyeRest';

export interface EyeRestHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: EyeRestProfile;
  onProfileChange: (profile: Partial<EyeRestProfile>) => void;
  result: EyeRestApertureResult;
  onApplyPreset: (mode: ShutterMode) => void;
}

export const EyeRestHUD: React.FC<EyeRestHUDProps> = ({
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
  const cx = svgW * 0.5;
  const cy = svgH * 0.5;
  const scale = 110 / 720;
  const rInner = Math.max(10, result.innerRadiusPx * scale);
  const rOuter = Math.max(20, result.outerRadiusPx * scale);

  return (
    <div
      role="region"
      aria-label="Eye Rest HUD"
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
              backgroundColor: result.isRestActive ? '#f59e0b' : (profile.isEnabled ? '#10b981' : '#71717a'),
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Eye-Rest Aperture Shutter
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
            SLA 68
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
          Aperture Profiles:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {Object.entries(EYE_REST_PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onApplyPreset(key as ShutterMode)}
              style={{
                backgroundColor: profile.shutterMode === key ? '#3f3f46' : '#27272a',
                color: profile.shutterMode === key ? '#38bdf8' : '#d4d4d8',
                border: profile.shutterMode === key ? '1px solid #38bdf8' : '1px solid #3f3f46',
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

      {/* 2D Aperture Mask SVG Visualizer */}
      <div style={{ marginBottom: '14px', backgroundColor: '#202023', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Focal Mask:</span>
          <span style={{ color: result.isRestActive ? '#f59e0b' : '#38bdf8' }}>
            {result.isRestActive ? 'REST INTERVAL ACTIVE' : `${profile.apertureRadiusPx}px RADIUS`}
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
            {/* Background peripheral shade */}
            <rect width={svgW} height={svgH} fill="rgba(12, 12, 14, 0.45)" />
            {/* Outer aperture boundary */}
            <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2" />
            {/* Inner focal core */}
            <circle cx={cx} cy={cy} r={rInner} fill="#121214" stroke="#38bdf8" strokeWidth="1.5" />
            {/* Central gaze anchor point */}
            <circle cx={cx} cy={cy} r={3} fill="#38bdf8" />
          </svg>
        </div>
      </div>

      {/* Controls & Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="apertureRadius-slider" style={{ color: '#d4d4d8' }}>
              Aperture Radius:
            </label>
            <span style={{ color: '#38bdf8' }}>{profile.apertureRadiusPx}px</span>
          </div>
          <input
            id="apertureRadius-slider"
            type="range"
            min={100}
            max={800}
            step={20}
            value={profile.apertureRadiusPx}
            onChange={e => onProfileChange({ apertureRadiusPx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <label htmlFor="falloff-slider" style={{ color: '#d4d4d8', fontSize: '11px' }}>
                Falloff:
              </label>
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>{profile.falloffPct}%</span>
            </div>
            <input
              id="falloff-slider"
              type="range"
              min={10}
              max={80}
              step={5}
              value={profile.falloffPct}
              onChange={e => onProfileChange({ falloffPct: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <label htmlFor="warmth-slider" style={{ color: '#d4d4d8', fontSize: '11px' }}>
                Warmth:
              </label>
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>{profile.eyeCareWarmthK}K</span>
            </div>
            <input
              id="warmth-slider"
              type="range"
              min={2200}
              max={6500}
              step={100}
              value={profile.eyeCareWarmthK}
              onChange={e => onProfileChange({ eyeCareWarmthK: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
          </div>
        </div>

        {/* Checkbox Preferences */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              id="enabled-toggle"
              type="checkbox"
              checked={profile.isEnabled}
              onChange={e => onProfileChange({ isEnabled: e.target.checked })}
              style={{ accentColor: '#10b981', cursor: 'pointer' }}
            />
            <label htmlFor="enabled-toggle" style={{ color: '#d4d4d8', cursor: 'pointer', fontSize: '11px' }}>
              Enable Aperture Shutter
            </label>
          </div>
        </div>
      </div>

      {/* Telemetry Footer */}
      <div
        style={{
          borderTop: '1px solid #27272a',
          paddingTop: '8px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          fontSize: '11px',
          color: '#a1a1aa',
        }}
      >
        <div>
          Focal Core: <span style={{ color: '#38bdf8' }}>{result.innerRadiusPx}px / {result.outerRadiusPx}px</span>
        </div>
        <div>
          Vignette Opacity: <span style={{ color: '#f59e0b' }}>{Math.round(result.vignetteOpacity * 100)}%</span>
        </div>
        <div>
          Warmth Filter: <span style={{ color: '#d4d4d8' }}>+{result.warmthSepiaPct}% Sepia</span>
        </div>
        <div>
          Latency: <span style={{ color: '#10b981' }}>{result.latencyUs.toFixed(2)}µs</span>
        </div>
      </div>

      <div
        style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#71717a',
          textAlign: 'center',
        }}
      >
        Press [R] to toggle Eye-Rest HUD
      </div>
    </div>
  );
};
