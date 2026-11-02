/**
 * KuraScroll - Sprint 88: Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time kinematic velocity, friction damping, and decay sleep telemetry.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import { InertialPresetId, INERTIAL_PRESETS } from '../../reader/useInertialScroll';

export interface InertialScrollHUDProps {
  isVisible: boolean;
  onClose: () => void;
  preset: InertialPresetId;
  onPresetChange: (preset: InertialPresetId) => void;
  currentPos: number;
  targetPos: number;
  velocity: number;
  isResting: boolean;
  frictionCoefficient: number;
  springTension: number;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const InertialScrollHUD: React.FC<InertialScrollHUDProps> = ({
  isVisible,
  onClose,
  preset,
  onPresetChange,
  currentPos,
  targetPos,
  velocity,
  isResting,
  frictionCoefficient,
  springTension,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Inertial Physics Scroller HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        width: '340px',
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
              backgroundColor: isEnabled ? (isResting ? '#38bdf8' : '#22c55e') : '#ef4444',
            }}
          />
          <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.02em' }}>
            INERTIAL SCROLLER
          </span>
          <span
            style={{
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            [N]
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
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
          FRICTION & DAMPING PRESET:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          {(['smooth_glider', 'natural_paper', 'crisp_snap'] as InertialPresetId[]).map((p) => {
            const isSelected = preset === p;
            const label = p === 'smooth_glider' ? 'Glider' : p === 'natural_paper' ? 'Paper' : 'Snap';
            return (
              <button
                key={p}
                onClick={() => onPresetChange(p)}
                style={{
                  padding: '6px 4px',
                  backgroundColor: isSelected ? '#3f3f46' : '#27272a',
                  color: isSelected ? '#38bdf8' : '#a1a1aa',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: isSelected ? 600 : 400,
                  textAlign: 'center',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Telemetry Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          backgroundColor: '#09090b',
          padding: '10px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>CURRENT VELOCITY</div>
          <div style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
            {Math.round(velocity)} px/s
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>PHYSICS STATUS</div>
          <div style={{ color: isResting ? '#38bdf8' : '#22c55e', fontSize: '12px', fontWeight: 600 }}>
            {isResting ? 'IDLE (0% CPU)' : 'GLIDING (60 FPS)'}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>FRICTION RETENTION</div>
          <div style={{ color: '#f59e0b', fontSize: '12px' }}>
            {(frictionCoefficient * 100).toFixed(0)}% / step
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>SPRING TENSION</div>
          <div style={{ color: '#a78bfa', fontSize: '12px' }}>
            {springTension} N/m
          </div>
        </div>
      </div>

      {/* Position progress */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '11px', marginBottom: '4px' }}>
          <span>Scroll Offset:</span>
          <span>{Math.round(currentPos)} px (Target: {Math.round(targetPos)} px)</span>
        </div>
      </div>

      {/* Footer Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #27272a' }}>
        <span style={{ color: '#71717a', fontSize: '10px' }}>
          {INERTIAL_PRESETS[preset]?.label || 'Natural Paper'}
        </span>
        <button
          onClick={onToggleEnabled}
          style={{
            background: 'none',
            border: 'none',
            color: isEnabled ? '#22c55e' : '#a1a1aa',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 4px',
            textDecoration: 'underline',
          }}
        >
          {isEnabled ? 'Scroller Active' : 'Scroller Paused'}
        </button>
      </div>
    </div>
  );
};
