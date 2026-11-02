/**
 * KuraScroll - Sprint 98: Predictive Intelligent Pre-Reading Micro-Heatmap Dwell Predictor HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Mechanical 4TB HDD (5400 RPM).
 * Displays real-time page reading dwell progression, prefetch trigger window, and HDD seek deferral state.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  PredictionMode,
  READING_DWELL_PRESETS,
} from '../../reader/useReadingDwell';

export interface ReadingDwellHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: PredictionMode;
  onModeChange: (mode: PredictionMode) => void;
  baseDwellMs: number;
  onBaseDwellMsChange: (val: number) => void;
  complexityWeight: number;
  onComplexityWeightChange: (val: number) => void;
  urgencyThresholdMs: number;
  onUrgencyThresholdMsChange: (val: number) => void;
  isPrefetchTriggerEnabled: boolean;
  onTogglePrefetchTrigger: () => void;
  elapsedMs: number;
  onElapsedMsChange?: (val: number) => void;
  predictedTotalDwellMs: number;
  remainingDwellMs: number;
  progressPct: number;
  isUrgentPrefetchTriggered: boolean;
  urgencyRatio: number;
  dwellProgressBarColor: string;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const ReadingDwellHUD: React.FC<ReadingDwellHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  baseDwellMs,
  onBaseDwellMsChange,
  complexityWeight,
  onComplexityWeightChange,
  urgencyThresholdMs,
  onUrgencyThresholdMsChange,
  isPrefetchTriggerEnabled,
  onTogglePrefetchTrigger,
  elapsedMs,
  onElapsedMsChange,
  predictedTotalDwellMs,
  remainingDwellMs,
  progressPct,
  isUrgentPrefetchTriggered,
  urgencyRatio,
  dwellProgressBarColor,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Reading Dwell Predictor HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '370px',
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
              backgroundColor: isEnabled ? '#10b981' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Cadence & Dwell Predictor
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
            [D]
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
            borderRadius: '4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          PREDICTION PROFILE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {(Object.keys(READING_DWELL_PRESETS) as PredictionMode[]).map((pKey) => {
            const isSelected = mode === pKey;
            return (
              <button
                key={pKey}
                onClick={() => onModeChange(pKey)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: isSelected ? '#3f3f46' : '#27272a',
                  color: isSelected ? '#38bdf8' : '#d4d4d8',
                  border: isSelected ? '1px solid #0284c7' : '1px solid transparent',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pKey === 'cadence_adaptive' && '⏱️ Adaptive'}
                {pKey === 'action_heavy' && '⚡ Action Fast'}
                {pKey === 'dialogue_dense' && '💬 Dialogue Dense'}
                {pKey === 'custom' && '⚙️ Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dwell Progress & Prefetch Window Bar */}
      <div
        style={{
          marginBottom: '14px',
          padding: '10px',
          backgroundColor: '#09090b',
          borderRadius: '6px',
          border: '1px solid #27272a',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: '#a1a1aa' }}>DWELL CYCLE PROGRESS</span>
          <span
            style={{
              fontSize: '10px',
              color: isUrgentPrefetchTriggered ? '#10b981' : '#f59e0b',
              fontWeight: 600,
            }}
          >
            {isUrgentPrefetchTriggered ? 'PREFETCH DISPATCHED' : 'SEEK DEFERRED'}
          </span>
        </div>

        {/* Progress Bar Container */}
        <div
          style={{
            height: '10px',
            backgroundColor: '#27272a',
            borderRadius: '5px',
            overflow: 'hidden',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              backgroundColor: dwellProgressBarColor,
              transition: 'width 0.2s ease, background-color 0.2s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#71717a' }}>
          <span>{progressPct}% ({elapsedMs}ms)</span>
          <span>Remaining: <strong style={{ color: '#fafafa' }}>{remainingDwellMs}ms</strong></span>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        {/* Base Dwell */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Base Dwell Time:</span>
            <span style={{ color: '#38bdf8' }}>{(baseDwellMs / 1000).toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="1000"
            max="30000"
            step="500"
            value={baseDwellMs}
            onChange={(e) => onBaseDwellMsChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* Complexity Weight */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Scene Complexity Weight:</span>
            <span style={{ color: '#38bdf8' }}>{complexityWeight.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="50"
            max="300"
            value={Math.round(complexityWeight * 100)}
            onChange={(e) => onComplexityWeightChange(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* Urgency Threshold */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>HDD Seek Urgency Window:</span>
            <span style={{ color: '#38bdf8' }}>{urgencyThresholdMs}ms</span>
          </div>
          <input
            type="range"
            min="200"
            max="3000"
            step="100"
            value={urgencyThresholdMs}
            onChange={(e) => onUrgencyThresholdMsChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>JIT Platter Prefetch Trigger:</span>
          <button
            onClick={onTogglePrefetchTrigger}
            style={{
              padding: '3px 8px',
              backgroundColor: isPrefetchTriggerEnabled ? '#0369a1' : '#27272a',
              color: isPrefetchTriggerEnabled ? '#e0f2fe' : '#a1a1aa',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isPrefetchTriggerEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>Cadence Engine:</span>
          <button
            onClick={onToggleEnabled}
            style={{
              padding: '3px 8px',
              backgroundColor: isEnabled ? '#059669' : '#27272a',
              color: isEnabled ? '#ecfdf5' : '#a1a1aa',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        </div>
      </div>

      {/* Telemetry Footer */}
      <div
        style={{
          borderTop: '1px solid #27272a',
          paddingTop: '10px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          fontSize: '10px',
          color: '#71717a',
        }}
      >
        <div>Target Dwell: <span style={{ color: '#a1a1aa' }}>{predictedTotalDwellMs}ms</span></div>
        <div>Elapsed: <span style={{ color: '#a1a1aa' }}>{elapsedMs}ms</span></div>
        <div>Remaining: <span style={{ color: '#a1a1aa' }}>{remainingDwellMs}ms</span></div>
        <div>Seek Dispatch: <span style={{ color: isUrgentPrefetchTriggered ? '#10b981' : '#f59e0b' }}>{isUrgentPrefetchTriggered ? 'DISPATCHED' : 'DEFERRED'}</span></div>
      </div>
    </div>
  );
};
