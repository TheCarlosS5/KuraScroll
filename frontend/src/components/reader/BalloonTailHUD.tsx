/**
 * KuraScroll - Sprint 116: Adaptive Dialogue Balloon Tail Tracking & Dynamic Focus Pointer HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure vector geometry tracking with quadratic bezier tail synthesis.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useBalloonTail,
  BALLOON_TAIL_PRESETS,
  TailStyle,
  BalloonShape,
} from '../../reader/useBalloonTail';

interface BalloonTailHUDProps {
  seriesId: string;
}

export const BalloonTailHUD: React.FC<BalloonTailHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    tailStyle,
    balloonShape,
    setBalloonShape,
    rootWidthPx,
    setRootWidthPx,
    curvatureFactor,
    setCurvatureFactor,
    isEnabled,
    setIsEnabled,
    balloonCenter,
    speakerTarget,
    setSpeakerTarget,
    currentResult,
    selectPreset,
  } = useBalloonTail(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-112 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Balloon Tail Pointer HUD (Hotkey: T)"
      >
        💬 Balloon Tail [T]
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
      data-testid="balloon-tail-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-amber-400">💬 Balloon Tail Vector</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 80
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

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1.5">Tail Style Presets</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(BALLOON_TAIL_PRESETS) as TailStyle[]).map((style) => {
            const isSelected = tailStyle === style;
            return (
              <button
                key={style}
                onClick={() => selectPreset(style)}
                className="px-2 py-1.5 text-[10px] rounded border text-left truncate transition-colors"
                style={{
                  backgroundColor: isSelected ? '#27272a' : '#141416',
                  borderColor: isSelected ? '#f59e0b' : '#27272a',
                  color: isSelected ? '#f59e0b' : '#a1a1aa',
                }}
              >
                {BALLOON_TAIL_PRESETS[style].label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-500 mt-1 italic">
          {BALLOON_TAIL_PRESETS[tailStyle].description}
        </p>
      </div>

      {/* SVG Interactive Vector Radar Preview */}
      <div className="mb-3 p-2 rounded border bg-black" style={{ borderColor: '#27272a' }}>
        <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
          <span>Vector Anchor Radar (0 Reflows)</span>
          <span className="text-amber-400">
            {currentResult.angleDeg.toFixed(1)}°
          </span>
        </div>
        <svg viewBox="0 0 320 200" className="w-full h-28 bg-zinc-950 rounded border border-zinc-900">
          {/* Grid lines */}
          <line x1="0" y1="100" x2="320" y2="100" stroke="#1f1f23" strokeDasharray="2,2" />
          <line x1="160" y1="0" x2="160" y2="200" stroke="#1f1f23" strokeDasharray="2,2" />

          {/* Dialogue Balloon Body */}
          {balloonShape === 'rounded_rect' ? (
            <rect
              x={balloonCenter.x - 65}
              y={balloonCenter.y - 40}
              width={130}
              height={80}
              rx={18}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="2"
            />
          ) : (
            <ellipse
              cx={balloonCenter.x}
              cy={balloonCenter.y}
              rx={65}
              ry={40}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="2"
            />
          )}

          {/* Synthesized Quadratic Bézier Tail */}
          {currentResult.svgPathD && (
            <path
              d={currentResult.svgPathD}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="2"
            />
          )}

          {/* Internal text sample */}
          <text
            x={balloonCenter.x}
            y={balloonCenter.y + 4}
            textAnchor="middle"
            fill="#18181b"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            なにっ?!
          </text>

          {/* Speaker Anchor Target Pin */}
          <circle
            cx={speakerTarget.x}
            cy={speakerTarget.y}
            r="6"
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          <text
            x={speakerTarget.x + 8}
            y={speakerTarget.y + 3}
            fill="#f87171"
            fontSize="8"
            fontFamily="monospace"
          >
            Speaker Target
          </text>
        </svg>
      </div>

      {/* Root Width Slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Root Width</span>
          <span className="text-amber-400 font-medium">{rootWidthPx.toFixed(1)} px</span>
        </div>
        <input
          type="range"
          min="6.0"
          max="32.0"
          step="1.0"
          value={rootWidthPx}
          onChange={(e) => setRootWidthPx(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Curvature Factor Slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Parabolic Curvature</span>
          <span className="text-amber-400 font-medium">
            {(curvatureFactor * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min="0.0"
          max="0.50"
          step="0.02"
          value={curvatureFactor}
          onChange={(e) => setCurvatureFactor(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Speaker Target Anchor Position (Interactive Slider) */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Speaker Anchor X</span>
          <span className="text-amber-400 font-medium">{speakerTarget.x} px</span>
        </div>
        <input
          type="range"
          min="50"
          max="280"
          step="5"
          value={speakerTarget.x}
          onChange={(e) =>
            setSpeakerTarget((prev) => ({ ...prev, x: parseInt(e.target.value, 10) }))
          }
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Live Telemetry Display */}
      <div
        className="p-2.5 rounded border text-[10px] space-y-1"
        style={{ backgroundColor: '#141416', borderColor: '#27272a' }}
      >
        <div className="text-zinc-400 font-semibold border-b border-zinc-800 pb-1 mb-1">
          Vector Geometry Telemetry
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Tail Arc Length:</span>
          <span className="text-zinc-300">{currentResult.lengthPx.toFixed(1)} px</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Departure Dihedral:</span>
          <span className="text-zinc-300">{currentResult.angleDeg.toFixed(1)}°</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Evaluator Latency:</span>
          <span className="text-emerald-400 font-bold">
            {currentResult.latencyUs < 1 ? '< 1.0' : currentResult.latencyUs.toFixed(2)} µs (SLA &lt; 20µs)
          </span>
        </div>
        <div className="flex justify-between truncate">
          <span className="text-zinc-500">SVG Path:</span>
          <span className="text-zinc-400 truncate max-w-[190px]" title={currentResult.svgPathD}>
            {currentResult.svgPathD}
          </span>
        </div>
      </div>
    </div>
  );
};
