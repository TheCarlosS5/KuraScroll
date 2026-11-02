/**
 * KuraScroll - Sprint 114: Adaptive Boustrophedon Panel Sequence Flow & Cinematic Camera Pan Director HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure transform-only camera motion HUD with cubic bezier trajectory radar.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useBoustrophedonCamera,
  CAMERA_FLOW_PRESETS,
  ReadingFlow,
  TransitionEasing,
} from '../../reader/useBoustrophedonCamera';

interface BoustrophedonCameraHUDProps {
  seriesId: string;
}

export const BoustrophedonCameraHUD: React.FC<BoustrophedonCameraHUDProps> = ({
  seriesId,
}) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    readingFlow,
    transitionEasing,
    setTransitionEasing,
    climaxZoomMultiplier,
    setClimaxZoomMultiplier,
    panLeadInPct,
    setPanLeadInPct,
    maxRotationDeg,
    setMaxRotationDeg,
    isEnabled,
    setIsEnabled,
    progress,
    setProgress,
    plan,
    currentCameraState,
    selectFlow,
  } = useBoustrophedonCamera(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-56 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Boustrophedon Camera Director HUD (Hotkey: C)"
      >
        📷 Camera Flow [C]
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
      data-testid="boustrophedon-camera-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-amber-400">📷 Camera Director</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 78
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-zinc-200 px-1 py-0.5 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Reading Flow Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1.5">Reading Sequence Flow</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(CAMERA_FLOW_PRESETS) as ReadingFlow[]).map((flow) => {
            const isSelected = readingFlow === flow;
            return (
              <button
                key={flow}
                onClick={() => selectFlow(flow)}
                className="px-2 py-1.5 text-[10px] rounded border text-left truncate transition-colors"
                style={{
                  backgroundColor: isSelected ? '#27272a' : '#141416',
                  borderColor: isSelected ? '#f59e0b' : '#27272a',
                  color: isSelected ? '#f59e0b' : '#a1a1aa',
                }}
              >
                {CAMERA_FLOW_PRESETS[flow].label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-500 mt-1 italic">
          {CAMERA_FLOW_PRESETS[readingFlow].description}
        </p>
      </div>

      {/* Bézier Radar Preview */}
      <div className="mb-3 p-2 rounded border bg-black" style={{ borderColor: '#27272a' }}>
        <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
          <span>Kinematic Trajectory Radar</span>
          <span className="text-amber-400">
            t = {(progress * 100).toFixed(0)}%
          </span>
        </div>
        <svg viewBox="0 0 200 80" className="w-full h-16 bg-zinc-950 rounded border border-zinc-900">
          {/* Grid lines */}
          <line x1="0" y1="40" x2="200" y2="40" stroke="#1f1f23" strokeDasharray="2,2" />
          <line x1="100" y1="0" x2="100" y2="80" stroke="#1f1f23" strokeDasharray="2,2" />

          {/* Bézier trajectory curve */}
          <path
            d="M 20 60 C 60 15, 140 65, 180 20"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
          />

          {/* Start Panel P0 indicator */}
          <circle cx="20" cy="60" r="4" fill="#3b82f6" />
          <text x="12" y="75" fill="#60a5fa" fontSize="8" fontFamily="monospace">P0</text>

          {/* End Panel P1 indicator */}
          <circle cx="180" cy="20" r="4" fill="#10b981" />
          <text x="175" y="35" fill="#34d399" fontSize="8" fontFamily="monospace">P1</text>

          {/* Current Camera Focal Position */}
          <circle
            cx={20 + progress * 160}
            cy={60 - progress * 40}
            r="5"
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Transition Easing Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1">Transition Easing</label>
        <select
          value={transitionEasing}
          onChange={(e) => setTransitionEasing(e.target.value as TransitionEasing)}
          className="w-full px-2 py-1 text-[11px] rounded border bg-zinc-900 text-zinc-200"
          style={{ borderColor: '#27272a' }}
        >
          <option value="cubic_bezier_cinematic">cubic-bezier(0.25, 0.1, 0.25, 1.0)</option>
          <option value="ease_in_out">ease-in-out smoothstep</option>
          <option value="snappy_linear">linear crisp snappy</option>
          <option value="dramatic_punch">dramatic punch onset</option>
        </select>
      </div>

      {/* Climax Zoom Multiplier Slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Climax Zoom Scale</span>
          <span className="text-amber-400 font-medium">
            {climaxZoomMultiplier.toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min="1.0"
          max="1.50"
          step="0.05"
          value={climaxZoomMultiplier}
          onChange={(e) => setClimaxZoomMultiplier(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Pan Lead-in Slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Pan Lead-In Offset</span>
          <span className="text-amber-400 font-medium">{panLeadInPct}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          step="5"
          value={panLeadInPct}
          onChange={(e) => setPanLeadInPct(parseInt(e.target.value, 10))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Trajectory Progress Scrubber */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Test Pan Progress (t)</span>
          <span className="text-amber-400 font-medium">
            {(progress * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={progress}
          onChange={(e) => setProgress(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Live Telemetry Display */}
      <div
        className="p-2.5 rounded border text-[10px] space-y-1"
        style={{ backgroundColor: '#141416', borderColor: '#27272a' }}
      >
        <div className="text-zinc-400 font-semibold border-b border-zinc-800 pb-1 mb-1">
          Cinematic Camera Telemetry
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Camera Focal (X, Y):</span>
          <span className="text-zinc-300">
            ({currentCameraState.x.toFixed(1)}, {currentCameraState.y.toFixed(1)}) px
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Active Focal Zoom:</span>
          <span className="text-amber-400">
            {currentCameraState.zoom.toFixed(3)}x
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Evaluator Latency:</span>
          <span className="text-emerald-400 font-bold">
            {currentCameraState.latencyUs < 1 ? '< 1.0' : currentCameraState.latencyUs.toFixed(2)} µs (SLA &lt; 20µs)
          </span>
        </div>
        <div className="flex justify-between truncate">
          <span className="text-zinc-500">CSS Transform:</span>
          <span className="text-zinc-400 truncate max-w-[190px]" title={currentCameraState.cssTransform}>
            {currentCameraState.cssTransform}
          </span>
        </div>
      </div>
    </div>
  );
};
