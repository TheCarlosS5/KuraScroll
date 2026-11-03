/**
 * KuraScroll - Sprint 129: Kinetic Peripheral Vignette & Micro-Saccade Gaze Stabilizer HUD
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'V'
 */

import React from 'react';
import {
  useGazeVignette,
  GazeVignettePresetName,
  GAZE_VIGNETTE_PRESETS,
} from '../../reader/useGazeVignette';

export interface GazeVignetteHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof useGazeVignette>;
}

export const GazeVignetteHUD: React.FC<GazeVignetteHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useGazeVignette(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    omega,
    setOmega,
    deadZonePx,
    setDeadZonePx,
    snapThresholdPx,
    setSnapThresholdPx,
    vignetteMax,
    setVignetteMax,
    radiusX,
    setRadiusX,
    radiusY,
    setRadiusY,
    q0,
    setQ0,
    q1,
    setQ1,
    isEnabled,
    setIsEnabled,
    probeCurrX,
    setProbeCurrX,
    probeCurrY,
    setProbeCurrY,
    probeTargetX,
    setProbeTargetX,
    probeTargetY,
    setProbeTargetY,
    currentResult,
    applyPreset,
    saveProfile,
  } = externalController ?? localController;

  if (!isHUDOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 left-72 z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Gaze Stabilizer & Peripheral Vignette HUD (Hotkey: V)"
      >
        <span className="text-emerald-400 font-bold mr-1.5">👁️ GAZE</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">V</kbd>
      </button>
    );
  }

  const statusLabel = currentResult.isSnapping
    ? 'SNAP (EDITORIAL)'
    : Math.abs(currentResult.currentX - probeTargetX) < deadZonePx &&
      Math.abs(currentResult.currentY - probeTargetY) < deadZonePx
    ? 'DEAD-ZONE (REST)'
    : 'DAMPED HARMONIC';

  const statusColor = currentResult.isSnapping
    ? 'text-amber-400'
    : statusLabel === 'DEAD-ZONE (REST)'
    ? 'text-blue-400'
    : 'text-emerald-400';

  return (
    <div
      role="dialog"
      aria-label="Kinetic Peripheral Vignette & Micro-Saccade Gaze Stabilizer HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">👁️ GAZE STABILIZER</span>
          <span className="text-[10px] text-zinc-400">SLA 93</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1 text-sm font-bold"
            title="Close HUD (V)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Immersion Preset</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(GAZE_VIGNETTE_PRESETS) as GazeVignettePresetName[]).map((key) => {
            const p = GAZE_VIGNETTE_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`px-2 py-1 text-left rounded text-[11px] truncate transition-colors ${
                  isSelected
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600 font-bold'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                }`}
                title={p.description}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Physics & Vignette Sliders */}
      <div className="space-y-2 mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        {/* Natural Frequency (omega) */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Oscillator Frequency (ω):</span>
            <span className="text-emerald-300 font-mono">{omega.toFixed(1)} rad/s</span>
          </div>
          <input
            type="range"
            min="4"
            max="32"
            step="1"
            value={omega}
            onChange={(e) => setOmega(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Micro-Saccade Dead-Zone */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Saccade Dead-Zone:</span>
            <span className="text-emerald-300 font-mono">{deadZonePx.toFixed(1)} px</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={deadZonePx}
            onChange={(e) => setDeadZonePx(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Editorial Snap Threshold */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Snap Jump Threshold:</span>
            <span className="text-emerald-300 font-mono">{snapThresholdPx.toFixed(0)} px</span>
          </div>
          <input
            type="range"
            min="50"
            max="300"
            step="10"
            value={snapThresholdPx}
            onChange={(e) => setSnapThresholdPx(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Peripheral Vignette Max */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Vignette Max Darkening:</span>
            <span className="text-emerald-300 font-mono">{(vignetteMax * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.50"
            step="0.02"
            value={vignetteMax}
            onChange={(e) => setVignetteMax(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Elliptical Radii Rx & Ry */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Radius X:</span>
              <span className="text-emerald-300 font-mono">{radiusX.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="1.00"
              step="0.05"
              value={radiusX}
              onChange={(e) => setRadiusX(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Radius Y:</span>
              <span className="text-emerald-300 font-mono">{radiusY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="1.00"
              step="0.05"
              value={radiusY}
              onChange={(e) => setRadiusY(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Quadratic Thresholds q0 & q1 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Inner q₀:</span>
              <span className="text-emerald-300 font-mono">{q0.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="1.50"
              step="0.05"
              value={q0}
              onChange={(e) => setQ0(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Outer q₁:</span>
              <span className="text-emerald-300 font-mono">{q1.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.50"
              max="2.50"
              step="0.05"
              value={q1}
              onChange={(e) => setQ1(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Interactive Probe Coordinates */}
      <div className="mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Live Eye / Target Probe</span>
          <span className={`text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-zinc-500">Current (Gaze):</span>
            <div className="flex gap-1 mt-0.5">
              <input
                type="number"
                value={probeCurrX}
                onChange={(e) => setProbeCurrX(Number(e.target.value))}
                className="w-1/2 bg-zinc-950 border border-zinc-700 px-1 py-0.5 rounded text-zinc-200"
              />
              <input
                type="number"
                value={probeCurrY}
                onChange={(e) => setProbeCurrY(Number(e.target.value))}
                className="w-1/2 bg-zinc-950 border border-zinc-700 px-1 py-0.5 rounded text-zinc-200"
              />
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Target (Panel):</span>
            <div className="flex gap-1 mt-0.5">
              <input
                type="number"
                value={probeTargetX}
                onChange={(e) => setProbeTargetX(Number(e.target.value))}
                className="w-1/2 bg-zinc-950 border border-zinc-700 px-1 py-0.5 rounded text-zinc-200"
              />
              <input
                type="number"
                value={probeTargetY}
                onChange={(e) => setProbeTargetY(Number(e.target.value))}
                className="w-1/2 bg-zinc-950 border border-zinc-700 px-1 py-0.5 rounded text-zinc-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry Output Display */}
      <div className="mb-3 bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Stabilized Pos:</span>
          <span className="text-emerald-400 font-bold font-mono">
            ({currentResult.stabilizedX.toFixed(1)}, {currentResult.stabilizedY.toFixed(1)})
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Gaze Velocity:</span>
          <span className="text-zinc-300 font-mono">
            ({currentResult.velocityX.toFixed(1)}, {currentResult.velocityY.toFixed(1)}) px/s
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Elliptical Distance q:</span>
          <span className="text-zinc-300 font-mono">{currentResult.qDistance.toFixed(3)}</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Peripheral Vignette:</span>
          <span className="text-amber-300 font-mono font-bold">
            {(currentResult.vignetteOpacity * 100).toFixed(1)}% opacity
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-zinc-800">
          <span className="text-zinc-500">SLA 93 Latency:</span>
          <span className="text-emerald-400 font-bold">
            {currentResult.latencyUs.toFixed(2)} µs (Budget &lt; 20 µs)
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={saveProfile}
          className="bg-emerald-600 hover:bg-emerald-500 text-black px-3 py-1 rounded text-[11px] font-bold transition-colors"
        >
          Save to Series
        </button>
        <span className="text-[10px] text-zinc-500">Intel T4500 Ready</span>
      </div>
    </div>
  );
};
