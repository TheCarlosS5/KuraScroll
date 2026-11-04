/**
 * KuraScroll - Sprint 105: Cross-Chapter Kinetic Scroll Momentum Deceleration & Seam Pre-Baking HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time seam momentum deceleration, magnetic snap latching, and pre-bake buffer telemetry.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  DecelerationMode,
  ChapterSeamProfile,
  ChapterSeamKinematicsResult,
  CHAPTER_SEAM_PRESETS,
} from '../../reader/useChapterSeam';

export interface ChapterSeamHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: ChapterSeamProfile;
  onProfileChange: (profile: Partial<ChapterSeamProfile>) => void;
  result: ChapterSeamKinematicsResult;
  onApplyPreset: (mode: DecelerationMode) => void;
}

export const ChapterSeamHUD: React.FC<ChapterSeamHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  onApplyPreset,
}) => {
  if (!isVisible) return null;

  const svgW = 340;
  const svgH = 100;
  const progressRatio = Math.max(0, Math.min(1, 1 - (result.distanceToSeamPx / profile.seamThresholdPx)));
  const seamX = svgW * 0.85;
  const runnerX = Math.max(20, Math.min(seamX, 20 + progressRatio * (seamX - 20)));

  return (
    <div
      role="region"
      aria-label="Chapter Seam HUD"
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
              backgroundColor: result.isMagneticSnapped ? '#f59e0b' : (result.isPreBakeActive ? '#10b981' : '#38bdf8'),
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Chapter Seam Decelerator
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
            SLA 69
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
          Kinetic Seam Presets:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {Object.entries(CHAPTER_SEAM_PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onApplyPreset(key as DecelerationMode)}
              style={{
                backgroundColor: profile.decelerationMode === key ? '#3f3f46' : '#27272a',
                color: profile.decelerationMode === key ? '#38bdf8' : '#d4d4d8',
                border: profile.decelerationMode === key ? '1px solid #38bdf8' : '1px solid #3f3f46',
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

      {/* 2D Seam Kinetic Radar SVG Visualizer */}
      <div style={{ marginBottom: '14px', backgroundColor: '#202023', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>Seam Proximity:</span>
          <span style={{ color: result.isMagneticSnapped ? '#f59e0b' : '#38bdf8' }}>
            {result.isMagneticSnapped ? 'MAGNETIC SNAP LOCKED' : `${result.distanceToSeamPx}px TO SEAM`}
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
            {/* Base timeline guide */}
            <line x1={20} y1={50} x2={svgW - 20} y2={50} stroke="#27272a" strokeWidth={2} />
            {/* Pre-bake trigger zone indicator */}
            <rect x={svgW * 0.4} y={35} width={seamX - svgW * 0.4} height={30} fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" strokeWidth={0.5} strokeDasharray="3 3" />
            <text x={svgW * 0.42} y={30} fill="#10b981" fontSize={8} fontFamily="monospace">PRE-BAKE ZONE</text>
            {/* Seam threshold boundary */}
            <line x1={seamX} y1={15} x2={seamX} y2={85} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
            <text x={seamX - 45} y={80} fill="#f59e0b" fontSize={8} fontFamily="monospace">SEAM</text>
            {/* Current scroll position runner */}
            <circle cx={runnerX} cy={50} r={6} fill="#38bdf8" stroke="#0284c7" strokeWidth={2} />
            <line x1={runnerX} y1={50} x2={runnerX + Math.min(40, result.adjustedVelocity * 0.04)} y2={50} stroke="#38bdf8" strokeWidth={2} />
          </svg>
        </div>
      </div>

      {/* Controls & Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="seamThreshold-slider" style={{ color: '#d4d4d8' }}>
              Seam Threshold:
            </label>
            <span style={{ color: '#38bdf8' }}>{profile.seamThresholdPx}px</span>
          </div>
          <input
            id="seamThreshold-slider"
            type="range"
            min={32}
            max={600}
            step={16}
            value={profile.seamThresholdPx}
            onChange={e => onProfileChange({ seamThresholdPx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="dampingFactor-slider" style={{ color: '#d4d4d8' }}>
              Viscous Damping:
            </label>
            <span style={{ color: '#38bdf8' }}>{Math.round(profile.dampingFactor * 100)}%</span>
          </div>
          <input
            id="dampingFactor-slider"
            type="range"
            min={10}
            max={99}
            step={1}
            value={Math.round(profile.dampingFactor * 100)}
            onChange={e => onProfileChange({ dampingFactor: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="preBakePanels-slider" style={{ color: '#d4d4d8' }}>
              Pre-Bake Window:
            </label>
            <span style={{ color: '#10b981' }}>{profile.preBakePanels} panels</span>
          </div>
          <input
            id="preBakePanels-slider"
            type="range"
            min={1}
            max={12}
            step={1}
            value={profile.preBakePanels}
            onChange={e => onProfileChange({ preBakePanels: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
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
          Resistance: <span style={{ color: '#f59e0b' }}>{result.seamResistancePct}%</span>
        </div>
        <div>
          Pre-Bake: <span style={{ color: result.isPreBakeActive ? '#10b981' : '#71717a' }}>{result.isPreBakeActive ? 'BUFFERED' : 'IDLE'}</span>
        </div>
        <div>
          Snap: <span style={{ color: result.isMagneticSnapped ? '#f59e0b' : '#38bdf8' }}>{result.isMagneticSnapped ? 'LATCHED' : 'ARMED'}</span>
        </div>
        <div>
          Latency: <span style={{ color: '#10b981' }}>{result.latencyUs < 1 ? '< 1 µs' : `${result.latencyUs.toFixed(1)} µs`}</span>
        </div>
      </div>

      {/* Tip footer */}
      <div style={{ marginTop: '10px', fontSize: '9px', color: '#71717a', textAlign: 'center' }}>
        Press <kbd style={{ backgroundColor: '#27272a', padding: '1px 4px', borderRadius: '2px', color: '#e4e4e7' }}>J</kbd> to toggle HUD
      </div>
    </div>
  );
};
