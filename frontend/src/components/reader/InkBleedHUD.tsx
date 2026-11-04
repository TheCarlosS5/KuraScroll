/**
 * KuraScroll - Sprint 103: Dynamic Contrast Tone-Mapping & Halftone Ink Bleed Compensator HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time parametric transfer curve SVG, black-point lift telemetry, and CSS filter strings.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  CompensationMode,
  InkBleedProfile,
  InkBleedCompensationResult,
  INK_BLEED_PRESETS,
} from '../../reader/useInkBleed';

export interface InkBleedHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: InkBleedProfile;
  onProfileChange: (profile: Partial<InkBleedProfile>) => void;
  result: InkBleedCompensationResult;
  onApplyPreset: (mode: CompensationMode) => void;
}

export const InkBleedHUD: React.FC<InkBleedHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  onApplyPreset,
}) => {
  if (!isVisible) return null;

  // Transfer curve coordinates: (0, 100 - bLift*100) to (300, 100 - wComp*100)
  const svgW = 340;
  const svgH = 100;
  const startY = svgH - profile.blackPointLift * svgH;
  const endY = svgH - profile.whitePointCompression * svgH;
  const midX = svgW * 0.5;
  const midY = svgH - Math.pow(0.5, 1 / profile.gammaExponent) * (profile.whitePointCompression - profile.blackPointLift) * svgH - profile.blackPointLift * svgH;

  const curvePath = `M 0 ${startY} Q ${midX} ${midY} ${svgW} ${endY}`;

  return (
    <div
      role="region"
      aria-label="Ink Bleed HUD"
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
            Ink Bleed & Tone Compensator
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
            SLA 67
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
        >&times;</button>
      </div>

      {/* Preset Buttons */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          Scan Profiles:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {Object.entries(INK_BLEED_PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onApplyPreset(key as CompensationMode)}
              style={{
                backgroundColor: profile.compensationMode === key ? '#3f3f46' : '#27272a',
                color: profile.compensationMode === key ? '#38bdf8' : '#d4d4d8',
                border: profile.compensationMode === key ? '1px solid #38bdf8' : '1px solid #3f3f46',
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

      {/* 2D Parametric Transfer Curve SVG */}
      <div style={{ marginBottom: '14px', backgroundColor: '#202023', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Transfer Function:</span>
          <span style={{ color: '#38bdf8' }}>γ = {result.effectiveGamma.toFixed(2)}</span>
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
          <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
            {/* Linear reference diagonal */}
            <line x1="0" y1={svgH} x2={svgW} y2="0" stroke="#3f3f46" strokeDasharray="3 3" strokeWidth="1" />
            {/* Dynamic transfer curve */}
            <path d={curvePath} fill="none" stroke="#38bdf8" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* Controls & Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="blackPointLift-slider" style={{ color: '#d4d4d8' }}>
              Black-Point Lift:
            </label>
            <span style={{ color: '#38bdf8' }}>{Math.round(profile.blackPointLift * 100)}%</span>
          </div>
          <input
            id="blackPointLift-slider"
            type="range"
            min={0.00}
            max={0.30}
            step={0.01}
            value={profile.blackPointLift}
            onChange={e => onProfileChange({ blackPointLift: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <label htmlFor="whitePointComp-slider" style={{ color: '#d4d4d8', fontSize: '11px' }}>
                White Comp:
              </label>
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>{Math.round(profile.whitePointCompression * 100)}%</span>
            </div>
            <input
              id="whitePointComp-slider"
              type="range"
              min={0.70}
              max={1.00}
              step={0.01}
              value={profile.whitePointCompression}
              onChange={e => onProfileChange({ whitePointCompression: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <label htmlFor="gamma-slider" style={{ color: '#d4d4d8', fontSize: '11px' }}>
                Gamma:
              </label>
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>{profile.gammaExponent.toFixed(2)}</span>
            </div>
            <input
              id="gamma-slider"
              type="range"
              min={0.50}
              max={2.50}
              step={0.05}
              value={profile.gammaExponent}
              onChange={e => onProfileChange({ gammaExponent: Number(e.target.value) })}
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
              Enable Ink Bleed Tone-Mapping
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
          Contrast: <span style={{ color: '#38bdf8' }}>{result.contrastMultiplier}%</span>
        </div>
        <div>
          Brightness: <span style={{ color: '#f59e0b' }}>{result.brightnessOffset}%</span>
        </div>
        <div>
          Slope/Intercept: <span style={{ color: '#d4d4d8' }}>{result.svgFilterSlope.toFixed(2)} / +{result.svgFilterIntercept.toFixed(2)}</span>
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
        Press [I] to toggle Ink Bleed HUD
      </div>
    </div>
  );
};
