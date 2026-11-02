/**
 * KuraScroll - Sprint 94: Multi-Tier Intelligent Storage Vault Tiering & Auto-Tiered Platter Eviction Manager HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays 3-tier storage distribution, HDD platter quota progress, and candidate eviction telemetry.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  AutoTieringMode,
  STORAGE_TIERING_PRESETS,
} from '../../reader/useStorageTiering';

export interface StorageTieringHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: AutoTieringMode;
  onModeChange: (mode: AutoTieringMode) => void;
  hotRetentionDays: number;
  onHotDaysChange: (days: number) => void;
  warmRetentionDays: number;
  onWarmDaysChange: (days: number) => void;
  diskQuotaTargetGb: number;
  onQuotaChange: (gb: number) => void;
  isAutoEvictionEnabled: boolean;
  onToggleAutoEvict: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  usedHotGb: number;
  usedWarmGb: number;
  usedColdGb: number;
  diskTotalGb: number;
  totalUsedGb: number;
  freeGb: number;
  quotaPercent: number;
  evictionCandidateCount: number;
  reclaimableGb: number;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const StorageTieringHUD: React.FC<StorageTieringHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  hotRetentionDays,
  onHotDaysChange,
  warmRetentionDays,
  onWarmDaysChange,
  diskQuotaTargetGb,
  onQuotaChange,
  isAutoEvictionEnabled,
  onToggleAutoEvict,
  isPinned,
  onTogglePin,
  usedHotGb,
  usedWarmGb,
  usedColdGb,
  diskTotalGb,
  totalUsedGb,
  freeGb,
  quotaPercent,
  evictionCandidateCount,
  reclaimableGb,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  const hotPct = ((usedHotGb / diskTotalGb) * 100).toFixed(1);
  const warmPct = ((usedWarmGb / diskTotalGb) * 100).toFixed(1);
  const coldPct = ((usedColdGb / diskTotalGb) * 100).toFixed(1);
  const freePct = ((freeGb / diskTotalGb) * 100).toFixed(1);

  return (
    <div
      role="region"
      aria-label="Storage Tiering & Eviction HUD"
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
              backgroundColor: isEnabled ? '#22c55e' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>
            STORAGE TIERING & EVICTION [V]
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

      {/* 3-Tier Visual Storage Bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#a1a1aa' }}>4TB HDD Platter Distribution</span>
          <span>{totalUsedGb} / {diskTotalGb} GB ({quotaPercent}% quota)</span>
        </div>
        <div
          style={{
            display: 'flex',
            height: '14px',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
          }}
        >
          <div style={{ width: `${hotPct}%`, backgroundColor: '#10b981' }} title={`Hot: ${usedHotGb} GB`} />
          <div style={{ width: `${warmPct}%`, backgroundColor: '#f59e0b' }} title={`Warm: ${usedWarmGb} GB`} />
          <div style={{ width: `${coldPct}%`, backgroundColor: '#3b82f6' }} title={`Cold: ${usedColdGb} GB`} />
          <div style={{ width: `${freePct}%`, backgroundColor: '#27272a' }} title={`Free: ${freeGb} GB`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px' }}>
          <span style={{ color: '#10b981' }}>● Hot {usedHotGb}G</span>
          <span style={{ color: '#f59e0b' }}>● Warm {usedWarmGb}G</span>
          <span style={{ color: '#3b82f6' }}>● Cold {usedColdGb}G</span>
          <span style={{ color: '#a1a1aa' }}>● Free {freeGb}G</span>
        </div>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: '#a1a1aa', marginBottom: '6px', fontSize: '11px' }}>
          RETENTION POLICY PRESET
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {(Object.keys(STORAGE_TIERING_PRESETS) as AutoTieringMode[]).map((m) => {
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
                {m === 'aggressive_evict' ? 'Aggressive' : m === 'balanced_hybrid' ? 'Balanced' : m === 'archive_pin' ? 'Archive Pin' : 'Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Disk Quota Target:</span>
            <span>{diskQuotaTargetGb} GB</span>
          </div>
          <input
            type="range"
            aria-label="Disk Quota Target"
            min="1000"
            max="4000"
            step="100"
            value={diskQuotaTargetGb}
            onChange={(e) => onQuotaChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Hot Tier Retention:</span>
            <span>{hotRetentionDays} days</span>
          </div>
          <input
            type="range"
            aria-label="Hot Tier Retention"
            min="1"
            max="60"
            step="1"
            value={hotRetentionDays}
            onChange={(e) => onHotDaysChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#a1a1aa' }}>Warm Tier Retention:</span>
            <span>{warmRetentionDays} days</span>
          </div>
          <input
            type="range"
            aria-label="Warm Tier Retention"
            min="7"
            max="180"
            step="1"
            value={warmRetentionDays}
            onChange={(e) => onWarmDaysChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={isAutoEvictionEnabled}
            onChange={onToggleAutoEvict}
            style={{ accentColor: '#3b82f6' }}
          />
          Auto-Eviction
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={isPinned}
            onChange={onTogglePin}
            style={{ accentColor: '#10b981' }}
          />
          Pin Series (Immunity)
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
          Arbitration Telemetry (SLA 58)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Total Used</div>
            <div style={{ fontWeight: 600, color: '#f4f4f5' }}>{totalUsedGb} GB</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Quota Saturation</div>
            <div style={{ fontWeight: 600, color: quotaPercent >= 90 ? '#ef4444' : '#34d399' }}>{quotaPercent}%</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Eviction Candidates</div>
            <div style={{ fontWeight: 600, color: '#f59e0b' }}>{evictionCandidateCount} chapters</div>
          </div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '10px' }}>Reclaimable Space</div>
            <div style={{ fontWeight: 600, color: '#60a5fa' }}>{reclaimableGb} GB</div>
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
        {isEnabled ? 'Disable Tiering Engine' : 'Enable Tiering Engine'}
      </button>
    </div>
  );
};
