/**
 * KuraScroll - Sprint 95: Adaptive Peripheral In-Viewport Motion-Deblur & Micro-Pan Stabilizer HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time gesture velocity damping, stabilized micro-pan displacement, and anti-ghosting contrast boost.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  StabilizerMode,
  MOTION_STABILIZER_PRESETS,
} from '../../reader/useMotionStabilizer';

export interface MotionStabilizerHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: StabilizerMode;
  onModeChange: (mode: StabilizerMode) => void;
  dampingCoefficient: number;
  onDampingChange: (val: number) => void;
  velocityThresholdPx: number;
  onThresholdChange: (val: number) => void;
  contrastBoostFactor: number;
  onContrastBoostChange: (val: number) => void;
  isAntiGhostingEnabled: boolean;
  onToggleAntiGhosting: () => void;
  currentVelocityPx: number;
  smoothedVelocityPx: number;
  stabilizedDeltaY: number;
  contrastScale: number;
  isHighSpeedDrag: boolean;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const MotionStabilizerHUD: React.FC<MotionStabilizerHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  dampingCoefficient,
  onDampingChange,
  velocityThresholdPx,
  onThresholdChange,
  contrastBoostFactor,
  onContrastBoostChange,
  isAntiGhostingEnabled,
  onToggleAntiGhosting,
  currentVelocityPx,
  smoothedVelocityPx,
  stabilizedDeltaY,
  contrastScale,
  isHighSpeedDrag,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  const speedRatio = Math.min(100, Math.round((Math.abs(smoothedVelocityPx) / velocityThresholdPx) * 100));

  return (
    <div
      role="region"
      aria-label="Motion Deblur & Stabilizer HUD"
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
            MOTION STABILIZER HUD [M]
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

      {/* Preset Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: '#a1a1aa', marginBottom: '6px', fontSize: '11px' }}>
          GESTURE STABILIZATION PRESET
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {(Object.keys(MOTION_STABILIZER_PRESETS) as StabilizerMode[]).map((m) => {
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
                {m === 'smooth_spring' ? 'Smooth Spring' : m === 'high_inertia_damping' ? 'Heavy Inertia' : m === 'esports_raw' ? 'eSports Raw' : 'Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Velocity Progress Bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Instantaneous Drag Velocity</span>
          <span>{Math.round(smoothedVelocityPx)} px/s ({speedRatio}%)</span>
        </div>
        <div
          style={{
            height: '8px',
            backgroundColor: '#27272a',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, speedRatio)}%`,
              height: '100%',
              backgroundColor: isHighSpeedDrag ? '#ef4444' : '#3b82f6',
              transition: 'width 0.1s ease-out',
            }}
          />
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Damping Coefficient:</span>
            <span>{dampingCoefficient.toFixed(2)}</span>
          </div>
          <input
            type="range"
            aria-label="Damping Coefficient"
            min="0.10"
            max="0.99"
            step="0.01"
            value={dampingCoefficient}
            onChange={(e) => onDampingChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Velocity Threshold:</span>
            <span>{Math.round(velocityThresholdPx)} px/s</span>
          </div>
          <input
            type="range"
            aria-label="Velocity Threshold"
            min="50"
            max="2000"
            step="25"
            value={velocityThresholdPx}
            onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Contrast Boost:</span>
            <span>×{contrastBoostFactor.toFixed(2)}</span>
          </div>
          <input
            type="range"
            aria-label="Contrast Boost"
            min="1.00"
            max="2.00"
            step="0.05"
            value={contrastBoostFactor}
            onChange={(e) => onContrastBoostChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={isAntiGhostingEnabled}
            onChange={onToggleAntiGhosting}
            style={{ accentColor: '#3b82f6' }}
          />
          LCD Anti-Ghosting Contrast Boost (60Hz TN)
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
          Kinematic Telemetry (SLA 59)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Smoothed Speed</div>
            <div style={{ fontWeight: 600, color: '#60a5fa' }}>{Math.round(smoothedVelocityPx)} px/s</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Stabilized Delta</div>
            <div style={{ fontWeight: 600, color: '#34d399' }}>{stabilizedDeltaY} px</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Contrast Mod</div>
            <div style={{ fontWeight: 600, color: contrastScale > 1.05 ? '#f59e0b' : '#a1a1aa' }}>×{contrastScale.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Motion State</div>
            <div style={{ fontWeight: 600, color: isHighSpeedDrag ? '#ef4444' : Math.abs(smoothedVelocityPx) > 50 ? '#38bdf8' : '#71717a' }}>
              {isHighSpeedDrag ? 'High Speed' : Math.abs(smoothedVelocityPx) > 50 ? 'Stabilized Pan' : 'Resting'}
            </div>
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
        {isEnabled ? 'Disable Motion Stabilizer' : 'Enable Motion Stabilizer'}
      </button>
    </div>
  );
};
