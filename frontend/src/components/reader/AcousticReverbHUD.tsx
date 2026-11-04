/**
 * KuraScroll - Sprint 108: Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time parametric Schroeder-Moorer acoustic reverberation, T60 decay curve, and early reflection taps.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  AcousticReverbProfile,
  AcousticReverbResult,
  SceneEnvironment,
  ACOUSTIC_REVERB_PRESETS,
} from '../../reader/useAcousticReverb';

export interface AcousticReverbHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: AcousticReverbProfile;
  onProfileChange: (params: Partial<AcousticReverbProfile>) => void;
  result: AcousticReverbResult;
  onApplyPreset: (preset: SceneEnvironment) => void;
}

export const AcousticReverbHUD: React.FC<AcousticReverbHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  onApplyPreset,
}) => {
  if (!isVisible) return null;

  const svgW = 340;
  const svgH = 80;

  // Generate parametric impulse response curve for SVG
  const decayPoints: string[] = [];
  const numSteps = 40;
  for (let i = 0; i <= numSteps; i++) {
    const normX = i / numSteps;
    const px = normX * (svgW - 20) + 10;
    // Exponential decay curve: y(t) = exp(-3.0 * t / T60)
    const decayFactor = Math.exp(-normX * Math.min(4.5, 3.0 / Math.max(0.2, result.t60DecayS)));
    const py = (svgH - 15) - decayFactor * (svgH - 25);
    decayPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const decayPath = `M 10,${svgH - 15} L ` + decayPoints.join(' L ');

  return (
    <div
      role="region"
      aria-label="Acoustic Reverb HUD"
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
              backgroundColor: result.isStable ? '#10b981' : '#f59e0b',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Acoustic Echo & Reverb
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
            SLA 72
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close HUD"
          style={{
            background: 'none',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 6px',
          }}
        >&times;</button>
      </div>

      {/* SVG Impulse Response Decay Envelope */}
      <div
        style={{
          border: '1px solid #27272a',
          backgroundColor: '#09090b',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Impulse Response Decay (T₆₀: {result.t60DecayS.toFixed(2)}s)</span>
          <span style={{ color: '#38bdf8' }}>Feedback: {result.feedbackGain.toFixed(3)}</span>
        </div>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', margin: '0 auto' }}
        >
          {/* Baseline */}
          <line x1="10" y1={svgH - 15} x2={svgW - 10} y2={svgH - 15} stroke="#27272a" strokeWidth="1" />
          {/* Exponential Decay Envelope */}
          <path d={decayPath} fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Early Reflection Taps */}
          {result.earlyReflectionTapsMs.map((tap, idx) => {
            const tapX = Math.min(svgW - 20, 10 + (tap / 128.0) * (svgW - 40));
            const tapHeight = Math.max(10, 45 - idx * 8);
            return (
              <line
                key={idx}
                x1={tapX}
                y1={svgH - 15}
                x2={tapX}
                y2={svgH - 15 - tapHeight}
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="2,1"
              />
            );
          })}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#71717a' }}>
          <span>Early Taps (Orange)</span>
          <span>Damping: {result.dampingFreqHz.toFixed(0)} Hz</span>
        </div>
      </div>

      {/* Telemetry Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: '#27272a',
            padding: '8px',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#71717a', fontSize: '10px' }}>Synth Latency</div>
          <div style={{ color: '#10b981', fontWeight: 600, fontSize: '13px' }}>
            {result.latencyUs.toFixed(1)} µs
          </div>
          <div style={{ color: '#52525b', fontSize: '9px' }}>SLA Target &lt; 20 µs</div>
        </div>
        <div
          style={{
            backgroundColor: '#27272a',
            padding: '8px',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#71717a', fontSize: '10px' }}>Wet / Dry Mix</div>
          <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '13px' }}>
            {Math.round(profile.wetDryMix * 100)}% Wet
          </div>
          <div style={{ color: '#52525b', fontSize: '9px' }}>Equal-Power Panning</div>
        </div>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#a1a1aa', fontSize: '11px', marginBottom: '6px' }}>Narrative Scene Environment</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {(['confined_room', 'cave_echo', 'outdoor_open', 'cathedral_vast', 'dampened_bedroom'] as SceneEnvironment[]).map((env) => {
            const isSelected = profile.sceneEnvironment === env;
            return (
              <button
                key={env}
                onClick={() => onApplyPreset(env)}
                style={{
                  padding: '5px 4px',
                  backgroundColor: isSelected ? '#3f3f46' : '#27272a',
                  color: isSelected ? '#fafafa' : '#a1a1aa',
                  border: isSelected ? '1px solid #71717a' : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {env.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle Controls */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onProfileChange({ isEnabled: !profile.isEnabled })}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: profile.isEnabled ? '#14532d' : '#27272a',
            color: profile.isEnabled ? '#86efac' : '#71717a',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          Reverb: {profile.isEnabled ? 'ACTIVE' : 'MUTED'}
        </button>
      </div>

      {/* Footer Hotkey Guide */}
      <div
        style={{
          marginTop: '10px',
          textAlign: 'center',
          color: '#52525b',
          fontSize: '10px',
        }}
      >
        Press <kbd style={{ color: '#d4d4d8', backgroundColor: '#27272a', padding: '1px 4px', borderRadius: '2px' }}>Y</kbd> to toggle HUD
      </div>
    </div>
  );
};
