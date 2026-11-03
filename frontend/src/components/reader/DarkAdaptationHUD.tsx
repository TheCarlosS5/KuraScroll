/**
 * KuraScroll - Sprint 118: Adaptive Perceptual Dark-Adaptation Retinal Preserver & Contrast Compensator HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure asymmetric EMA temporal adaptation with white-point clamping & contrast compensation.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useDarkAdaptation,
  DARK_ADAPTATION_PRESETS,
  DarkAdaptationPresetName,
} from '../../reader/useDarkAdaptation';

interface DarkAdaptationHUDProps {
  seriesId: string;
}

export const DarkAdaptationHUD: React.FC<DarkAdaptationHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    comfortLuminance,
    setComfortLuminance,
    glareThreshold,
    setGlareThreshold,
    baseWhitePoint,
    setBaseWhitePoint,
    isEnabled,
    setIsEnabled,
    inputLuminance,
    currentResult,
    selectPreset,
    simulateLuminanceStep,
  } = useDarkAdaptation(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-168 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Dark Adaptation Retinal HUD (Hotkey: D)"
      >
        🌙 Dark Adapt [D]
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="dark-adaptation-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-indigo-400">🌙 Retinal Adaptation</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 82
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: D)"
          >
            ×
          </button>
        </div>
      </div>

      {/* Real-Time Adaptation Telemetry Gauges */}
      <div className="mb-3 p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-2">
        {/* Input vs Adapted Luminance */}
        <div>
          <div className="flex justify-between items-center mb-1 text-[10px]">
            <span className="text-zinc-400">Input / Adapted Luminance:</span>
            <span className="text-indigo-400 font-bold">
              {(inputLuminance * 100).toFixed(0)}% → {(currentResult.adaptedLuminance * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2 rounded bg-zinc-800 overflow-hidden flex">
            <div
              className="h-full bg-zinc-600 transition-all duration-150"
              style={{ width: `${Math.min(100, inputLuminance * 100)}%` }}
              title="Raw Input Scene Luminance"
            />
            <div
              className="h-full bg-indigo-500 transition-all duration-150"
              style={{ width: `${Math.min(100, currentResult.adaptedLuminance * 100)}%` }}
              title="Smooth Adapted Retinal Luminance"
            />
          </div>
        </div>

        {/* White Point & Glare Suppression */}
        <div>
          <div className="flex justify-between items-center mb-1 text-[10px]">
            <span className="text-zinc-400">White Point Clamping:</span>
            <span className="text-emerald-400 font-bold">
              {(currentResult.whitePoint * 100).toFixed(1)}% (Glare: {(currentResult.glareRatio * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="w-full h-2 rounded bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${Math.min(100, currentResult.whitePoint * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-900 text-zinc-400">
          <span>Contrast Multiplier:</span>
          <span className="text-amber-400 font-bold">{currentResult.contrast.toFixed(2)}x</span>
        </div>
        <div className="flex justify-between text-[11px] text-zinc-400">
          <span>Calculation Latency:</span>
          <span className="text-indigo-400 font-mono">{currentResult.latencyUs.toFixed(2)} µs</span>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <div className="text-[11px] text-zinc-400 mb-1">Preset Profile:</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(DARK_ADAPTATION_PRESETS) as DarkAdaptationPresetName[]).map((key) => {
            const preset = DARK_ADAPTATION_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                onClick={() => selectPreset(key)}
                className="px-2 py-1 rounded text-left border text-[10px] truncate transition-colors"
                style={{
                  backgroundColor: isSelected ? '#1c1c38' : '#27272a',
                  borderColor: isSelected ? '#6366f1' : '#3f3f46',
                  color: isSelected ? '#a5b4fc' : '#a1a1aa',
                }}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Comfort Luminance:</span>
          <span className="text-indigo-400 font-bold">{(comfortLuminance * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.05"
          max="0.80"
          step="0.05"
          value={comfortLuminance}
          onChange={(e) => setComfortLuminance(parseFloat(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer h-1 bg-zinc-800 rounded"
        />

        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Base White Point:</span>
          <span className="text-indigo-400 font-bold">{(baseWhitePoint * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.50"
          max="1.00"
          step="0.02"
          value={baseWhitePoint}
          onChange={(e) => setBaseWhitePoint(parseFloat(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer h-1 bg-zinc-800 rounded"
        />
      </div>

      {/* Simulation Controls */}
      <div className="flex space-x-1.5">
        <button
          onClick={() => simulateLuminanceStep(0.08)}
          className="flex-1 py-1 px-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-[10px]"
          title="Simulate transition to dark inked page"
        >
          Ink Dark (8%)
        </button>
        <button
          onClick={() => simulateLuminanceStep(0.95)}
          className="flex-1 py-1 px-2 rounded bg-amber-950 border border-amber-800 text-amber-300 hover:bg-amber-900 text-[10px]"
          title="Simulate sudden blinding white splash page"
        >
          Splash (95%)
        </button>
        <button
          onClick={() => simulateLuminanceStep(0.45)}
          className="flex-1 py-1 px-2 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 text-[10px]"
          title="Simulate standard balanced midtone page"
        >
          Midtone (45%)
        </button>
      </div>
    </div>
  );
};
