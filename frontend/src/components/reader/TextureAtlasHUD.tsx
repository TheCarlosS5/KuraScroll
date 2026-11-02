/**
 * KuraScroll - Sprint 112: Micro-Tile GPU Texture Atlas Packer & Virtual VRAM Compactor HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time 2D texture atlas packing radar, UV coordinate offsets, and VRAM budget compaction.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  TextureAtlasProfile,
  TextureAtlasPlacementResult,
  TEXTURE_ATLAS_PRESETS,
} from '../../reader/useTextureAtlas';

export interface TextureAtlasHUDProps {
  isVisible: boolean;
  onClose: () => void;
  profile: TextureAtlasProfile;
  onProfileChange: (params: Partial<TextureAtlasProfile>) => void;
  sampleResult: TextureAtlasPlacementResult;
  onApplyPreset: (presetKey: string) => void;
}

export const TextureAtlasHUD: React.FC<TextureAtlasHUDProps> = ({
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
      aria-label="Texture Atlas HUD"
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
            GPU Texture Atlas
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
            SLA 76
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

      {/* Atlas Radar Preview */}
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
          <span>DIM: <strong>{profile.atlasMaxDimension}x{profile.atlasMaxDimension}</strong></span>
          <span>PAGE: <strong>#{sampleResult.atlasIndex}</strong></span>
          <span>DENSITY: <strong style={{ color: '#10b981' }}>{sampleResult.packingDensityPct}%</strong></span>
        </div>

        {/* 2D Atlas Grid Visualization */}
        <div
          style={{
            height: '64px',
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: 'repeat(4, 1fr)',
            gap: '2px',
            padding: '2px',
          }}
        >
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: idx === 0 ? '#10b981' : idx < 3 ? '#065f46' : '#27272a',
                borderRadius: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8px',
                color: idx < 3 ? '#ffffff' : '#52525b',
              }}
            >
              {idx === 0 ? 'ACTIVE' : idx < 3 ? 'WARM' : 'FREE'}
            </div>
          ))}
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
          <span>UV: ({sampleResult.u.toFixed(3)}, {sampleResult.v.toFixed(3)})</span>
          <span>Padding: {sampleResult.paddedW - sampleResult.w}px safe</span>
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
          <div style={{ color: '#71717a', fontSize: '10px' }}>VRAM USAGE</div>
          <div style={{ fontWeight: 600, color: '#fafafa' }}>
            {sampleResult.vramUsageMb} MB / {profile.vramBudgetMb} MB
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>ACTIVE ATLASES</div>
          <div style={{ fontWeight: 600, color: '#38bdf8' }}>
            {sampleResult.activeAtlasesCount} / {profile.maxActiveAtlases}
          </div>
        </div>
        <div>
          <div style={{ color: '#71717a', fontSize: '10px' }}>SLA 76 LATENCY</div>
          <div style={{ fontWeight: 600, color: '#4ade80' }}>
            {sampleResult.latencyUs.toFixed(2)} µs
          </div>
        </div>
      </div>

      {/* Hardware Presets */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          HARDWARE ATLAS PRESETS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
          }}
        >
          {Object.keys(TEXTURE_ATLAS_PRESETS).map((key) => {
            const p = TEXTURE_ATLAS_PRESETS[key];
            const isSelected = profile.atlasMaxDimension === p.atlasMaxDimension && profile.vramBudgetMb === p.vramBudgetMb;
            return (
              <button
                key={key}
                onClick={() => onApplyPreset(key)}
                style={{
                  backgroundColor: isSelected ? '#059669' : '#27272a',
                  border: 'none',
                  borderRadius: '4px',
                  color: isSelected ? '#ffffff' : '#a1a1aa',
                  padding: '6px 4px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={p.description}
              >
                {key === 'gma_4500mhd_strict' ? 'GMA 4500MHD' : key === 'hd_canvas_4096' ? '4096 HD' : '1024 Low'}
              </button>
            );
          })}
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
            style={{ accentColor: '#10b981' }}
          />
          <span style={{ color: '#fafafa', fontSize: '11px' }}>
            Enable GPU Texture Atlas Packing
          </span>
        </label>

        {/* Tile Padding Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Anti-Bleed Border Padding</span>
            <span style={{ color: '#fafafa' }}>{profile.tilePaddingPx}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={16}
            step={2}
            value={profile.tilePaddingPx}
            onChange={(e) =>
              onProfileChange({
                tilePaddingPx: parseInt(e.target.value, 10),
              })
            }
            style={{ width: '100%', accentColor: '#10b981' }}
          />
        </div>

        {/* VRAM Budget Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Virtual VRAM Budget</span>
            <span style={{ color: '#fafafa' }}>{profile.vramBudgetMb} MB</span>
          </div>
          <input
            type="range"
            min={16}
            max={64}
            step={16}
            value={profile.vramBudgetMb}
            onChange={(e) =>
              onProfileChange({
                vramBudgetMb: parseInt(e.target.value, 10),
              })
            }
            style={{ width: '100%', accentColor: '#10b981' }}
          />
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
        <span>Toggle shortcut: [A]</span>
        <span>Intel GMA 4500MHD Safe</span>
      </div>
    </div>
  );
};
