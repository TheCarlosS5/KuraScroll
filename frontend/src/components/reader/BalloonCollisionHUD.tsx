/**
 * KuraScroll - Sprint 102: Adaptive Per-Panel Reading Path Spatial Occlusion & Balloon Collision Avoider HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time 2D AABB spatial collision radar and non-occluding displacement telemetry.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  AvoidanceStrategy,
  BalloonCollisionProfile,
  CollisionAvoidanceResult,
  BoundingBox,
  BALLOON_COLLISION_PRESETS,
} from '../../reader/useBalloonCollision';

export interface BalloonCollisionHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: BalloonCollisionProfile;
  onProfileChange: (profile: Partial<BalloonCollisionProfile>) => void;
  result: CollisionAvoidanceResult;
  onApplyPreset: (presetKey: AvoidanceStrategy) => void;
  overlayBox?: BoundingBox;
  balloonBoxes?: BoundingBox[];
}

export const BalloonCollisionHUD: React.FC<BalloonCollisionHUDProps> = ({
  isVisible,
  onClose,
  profile,
  onProfileChange,
  result,
  onApplyPreset,
  overlayBox = { x: 200, y: 200, width: 140, height: 70 },
  balloonBoxes = [{ x: 180, y: 180, width: 160, height: 100 }],
}) => {
  if (!isVisible) return null;

  // Mini radar scale: 1280x720 scaled to 340x190
  const scale = 340 / 1280;

  return (
    <div
      role="region"
      aria-label="Balloon Collision HUD"
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
              backgroundColor: result.hasCollision ? '#f59e0b' : '#10b981',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Balloon Collision Avoider
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
            SLA 66
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
          Avoidance Strategies:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {Object.entries(BALLOON_COLLISION_PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onApplyPreset(key as AvoidanceStrategy)}
              style={{
                backgroundColor: profile.avoidanceStrategy === key ? '#3f3f46' : '#27272a',
                color: profile.avoidanceStrategy === key ? '#38bdf8' : '#d4d4d8',
                border: profile.avoidanceStrategy === key ? '1px solid #38bdf8' : '1px solid #3f3f46',
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

      {/* 2D AABB Mini Radar */}
      <div style={{ marginBottom: '14px', backgroundColor: '#202023', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>2D Spatial Radar:</span>
          <span style={{ color: result.hasCollision ? '#f59e0b' : '#10b981' }}>
            {result.hasCollision ? 'OCCLUSION DETECTED' : 'CLEAR PATH'}
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '110px',
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Speech Balloons in Red/Amber */}
          {balloonBoxes.map((b, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: `${b.x * scale}px`,
                top: `${b.y * scale}px`,
                width: `${b.width * scale}px`,
                height: `${b.height * scale}px`,
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid #ef4444',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                color: '#f87171',
              }}
            >
              Balloon
            </div>
          ))}

          {/* Original Overlay Outline (dashed) */}
          <div
            style={{
              position: 'absolute',
              left: `${overlayBox.x * scale}px`,
              top: `${overlayBox.y * scale}px`,
              width: `${overlayBox.width * scale}px`,
              height: `${overlayBox.height * scale}px`,
              border: '1px dashed #71717a',
              borderRadius: '4px',
            }}
          />

          {/* Displaced Overlay Box */}
          <div
            style={{
              position: 'absolute',
              left: `${result.displacedBox.x * scale}px`,
              top: `${result.displacedBox.y * scale}px`,
              width: `${result.displacedBox.width * scale}px`,
              height: `${result.displacedBox.height * scale}px`,
              backgroundColor: 'rgba(56, 189, 248, 0.3)',
              border: '1px solid #38bdf8',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              color: '#38bdf8',
              fontWeight: 600,
            }}
          >
            Overlay
          </div>
        </div>
      </div>

      {/* Sliders & Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="safetyMargin-slider" style={{ color: '#d4d4d8' }}>
              Safety Margin:
            </label>
            <span style={{ color: '#38bdf8' }}>{profile.safetyMarginPx}px</span>
          </div>
          <input
            id="safetyMargin-slider"
            type="range"
            min={0}
            max={64}
            step={2}
            value={profile.safetyMarginPx}
            onChange={e => onProfileChange({ safetyMarginPx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <label htmlFor="maxDisplacement-slider" style={{ color: '#d4d4d8' }}>
              Max Displacement:
            </label>
            <span style={{ color: '#f59e0b' }}>{profile.maxDisplacementPx}px</span>
          </div>
          <input
            id="maxDisplacement-slider"
            type="range"
            min={20}
            max={400}
            step={10}
            value={profile.maxDisplacementPx}
            onChange={e => onProfileChange({ maxDisplacementPx: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
        </div>

        {/* Checkbox Preferences */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              id="preferVertical-toggle"
              type="checkbox"
              checked={profile.preferVerticalShift}
              onChange={e => onProfileChange({ preferVerticalShift: e.target.checked })}
              style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
            />
            <label htmlFor="preferVertical-toggle" style={{ color: '#d4d4d8', cursor: 'pointer', fontSize: '11px' }}>
              Prefer Vertical Shift
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              id="enabled-toggle"
              type="checkbox"
              checked={profile.isEnabled}
              onChange={e => onProfileChange({ isEnabled: e.target.checked })}
              style={{ accentColor: '#10b981', cursor: 'pointer' }}
            />
            <label htmlFor="enabled-toggle" style={{ color: '#d4d4d8', cursor: 'pointer', fontSize: '11px' }}>
              Active
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
          Shift Δ: <span style={{ color: '#38bdf8' }}>({result.dx >= 0 ? `+${result.dx}` : result.dx}, {result.dy >= 0 ? `+${result.dy}` : result.dy})px</span>
        </div>
        <div>
          Magnitude: <span style={{ color: '#f59e0b' }}>{result.displacementMagnitude}px</span>
        </div>
        <div>
          Balloons Dodged: <span style={{ color: '#10b981' }}>{result.collidingBalloonIndices.length}</span>
        </div>
        <div>
          Latency: <span style={{ color: '#d4d4d8' }}>{result.latencyUs.toFixed(2)}µs</span>
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
        Press [O] to toggle Balloon Collision HUD
      </div>
    </div>
  );
};
