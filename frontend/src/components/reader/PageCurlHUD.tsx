/**
 * KuraScroll - Sprint 93: Bi-Temporal Gaze & Velocity Dynamic Page Curl & Turn HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time 2.5D page curl kinematics and tactile resistance parameters without host CPU overhead.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  CurlPreset,
  PAGE_CURL_PRESETS,
} from '../../reader/usePageCurl';

export interface PageCurlHUDProps {
  isVisible: boolean;
  onClose: () => void;
  preset: CurlPreset;
  onPresetChange: (preset: CurlPreset) => void;
  paperStiffness: number;
  onStiffnessChange: (val: number) => void;
  maxCurlAngleDeg: number;
  onMaxAngleChange: (val: number) => void;
  shadowDepth: number;
  onShadowDepthChange: (val: number) => void;
  isPeelCornerEnabled: boolean;
  onToggleCornerPeel: () => void;
  dragProgress: number;
  onDragProgressChange: (val: number) => void;
  effectiveAngleDeg: number;
  cornerPeelPercent: number;
  shadowOpacity: number;
  isCompleted: boolean;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  isRtl: boolean;
  onToggleRtl: () => void;
}

export const PageCurlHUD: React.FC<PageCurlHUDProps> = ({
  isVisible,
  onClose,
  preset,
  onPresetChange,
  paperStiffness,
  onStiffnessChange,
  maxCurlAngleDeg,
  onMaxAngleChange,
  shadowDepth,
  onShadowDepthChange,
  isPeelCornerEnabled,
  onToggleCornerPeel,
  dragProgress,
  onDragProgressChange,
  effectiveAngleDeg,
  cornerPeelPercent,
  shadowOpacity,
  isCompleted,
  isEnabled,
  onToggleEnabled,
  isRtl,
  onToggleRtl,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Page Curl Physics HUD"
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
            PAGE CURL & TURN HUD [K]
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
          PAPER PRESET
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {(Object.keys(PAGE_CURL_PRESETS) as CurlPreset[]).map((p) => {
            const isSelected = preset === p;
            return (
              <button
                key={p}
                onClick={() => onPresetChange(p)}
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
                {p === 'tankobon_stiff' ? 'Tankōbon' : p === 'doujin_silk' ? 'Silk' : p === 'newsprint_pulp' ? 'Newsprint' : 'Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Paper Stiffness:</span>
            <span>{paperStiffness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            aria-label="Paper Stiffness"
            min="0.20"
            max="1.00"
            step="0.01"
            value={paperStiffness}
            onChange={(e) => onStiffnessChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Max Curl Angle:</span>
            <span>{maxCurlAngleDeg.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            aria-label="Max Curl Angle"
            min="15"
            max="85"
            step="1"
            value={maxCurlAngleDeg}
            onChange={(e) => onMaxAngleChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Spine Shadow Depth:</span>
            <span>{shadowDepth.toFixed(2)}</span>
          </div>
          <input
            type="range"
            aria-label="Spine Shadow Depth"
            min="0.00"
            max="1.00"
            step="0.05"
            value={shadowDepth}
            onChange={(e) => onShadowDepthChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Drag Simulation:</span>
            <span>{Math.round(dragProgress * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label="Drag Simulation"
            min="0.00"
            max="1.00"
            step="0.01"
            value={dragProgress}
            onChange={(e) => onDragProgressChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={isPeelCornerEnabled}
            onChange={onToggleCornerPeel}
            style={{ accentColor: '#3b82f6' }}
          />
          Corner Peel
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={isRtl}
            onChange={onToggleRtl}
            style={{ accentColor: '#3b82f6' }}
          />
          RTL (Manga)
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
          2.5D Kinematic Telemetry
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Effective Angle</div>
            <div style={{ fontWeight: 600, color: '#60a5fa' }}>{effectiveAngleDeg}°</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Corner Peel</div>
            <div style={{ fontWeight: 600, color: '#34d399' }}>{cornerPeelPercent}%</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Shadow Opacity</div>
            <div style={{ fontWeight: 600, color: '#f59e0b' }}>{Math.round(shadowOpacity * 100)}%</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Status</div>
            <div style={{ fontWeight: 600, color: isCompleted ? '#22c55e' : dragProgress > 0 ? '#38bdf8' : '#71717a' }}>
              {isCompleted ? 'Completed' : dragProgress > 0 ? 'Peeling' : 'Resting'}
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
        {isEnabled ? 'Disable Page Curl Engine' : 'Enable Page Curl Engine'}
      </button>
    </div>
  );
};
