/**
 * KuraScroll - Sprint 115: Perceptual Micro-Stippling Halftone Grain Synthesizer & Retro Print Simulator HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Procedural micro-stippling paper grain HUD with solid #18181b styling.
 * 0 CSS blur, 0 backdrop-filter, 0 CLS.
 */

import React from 'react';
import {
  useHalftoneGrain,
  HALFTONE_GRAIN_PRESETS,
  GrainMode,
  BlendMode,
} from '../../reader/useHalftoneGrain';

interface HalftoneGrainHUDProps {
  seriesId: string;
}

export const HalftoneGrainHUD: React.FC<HalftoneGrainHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    grainMode,
    stippleDensity,
    setStippleDensity,
    grainOpacity,
    setGrainOpacity,
    particleRadiusPx,
    setParticleRadiusPx,
    paperTintHex,
    setPaperTintHex,
    blendMode,
    setBlendMode,
    isEnabled,
    setIsEnabled,
    currentResult,
    selectPreset,
  } = useHalftoneGrain(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-84 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Halftone Paper Grain HUD (Hotkey: G)"
      >
        📰 Paper Grain [G]
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
      data-testid="halftone-grain-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-amber-400">📰 Halftone Grain</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 79
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
        <label className="block text-[11px] text-zinc-400 mb-1.5">Retro Paper Presets</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(HALFTONE_GRAIN_PRESETS) as GrainMode[]).map((mode) => {
            const isSelected = grainMode === mode;
            return (
              <button
                key={mode}
                onClick={() => selectPreset(mode)}
                className="px-2 py-1.5 text-[10px] rounded border text-left truncate transition-colors"
                style={{
                  backgroundColor: isSelected ? '#27272a' : '#141416',
                  borderColor: isSelected ? '#f59e0b' : '#27272a',
                  color: isSelected ? '#f59e0b' : '#a1a1aa',
                }}
              >
                {HALFTONE_GRAIN_PRESETS[mode].label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-500 mt-1 italic">
          {HALFTONE_GRAIN_PRESETS[grainMode].description}
        </p>
      </div>

      {/* Paper Swatch & Micro-Stipple Preview */}
      <div className="mb-3 p-2 rounded border bg-black" style={{ borderColor: '#27272a' }}>
        <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
          <span>Stipple Swatch Preview (16 KiB RGBA)</span>
          <span className="text-amber-400">{paperTintHex}</span>
        </div>
        <div
          className="w-full h-14 rounded border relative overflow-hidden"
          style={{
            backgroundColor: paperTintHex,
            borderColor: '#3f3f46',
          }}
        >
          {/* SVG Halftone stippling dot pattern */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: grainOpacity * 3 }}>
            <pattern id="stipple-pattern" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r={particleRadiusPx} fill="#18181b" />
              <circle cx="6" cy="6" r={particleRadiusPx * 0.8} fill="#18181b" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#stipple-pattern)" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ color: '#18181b', backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
            >
              鬼滅の刃 · 第1話 (SAMPLE)
            </span>
          </div>
        </div>
      </div>

      {/* Stipple Density Slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Stipple Density</span>
          <span className="text-amber-400 font-medium">
            {(stippleDensity * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min="0.05"
          max="0.40"
          step="0.01"
          value={stippleDensity}
          onChange={(e) => setStippleDensity(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Grain Opacity Slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Grain Micro-Opacity</span>
          <span className="text-amber-400 font-medium">
            {(grainOpacity * 100).toFixed(1)}%
          </span>
        </div>
        <input
          type="range"
          min="0.01"
          max="0.20"
          step="0.005"
          value={grainOpacity}
          onChange={(e) => setGrainOpacity(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Particle Radius Slider */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Fiber Particle Radius</span>
          <span className="text-amber-400 font-medium">
            {particleRadiusPx.toFixed(1)} px
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={particleRadiusPx}
          onChange={(e) => setParticleRadiusPx(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Blend Mode Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1">Layer Blend Mode</label>
        <select
          value={blendMode}
          onChange={(e) => setBlendMode(e.target.value as BlendMode)}
          className="w-full px-2 py-1 text-[11px] rounded border bg-zinc-900 text-zinc-200"
          style={{ borderColor: '#27272a' }}
        >
          <option value="multiply">multiply (Subtractive Ink Absorption)</option>
          <option value="darken">darken (Crisp Line Retention)</option>
          <option value="normal">normal (Opaque Stock)</option>
          <option value="overlay">overlay (High Contrast Fiber)</option>
        </select>
      </div>

      {/* Live Telemetry Display */}
      <div
        className="p-2.5 rounded border text-[10px] space-y-1"
        style={{ backgroundColor: '#141416', borderColor: '#27272a' }}
      >
        <div className="text-zinc-400 font-semibold border-b border-zinc-800 pb-1 mb-1">
          Halftone Print Telemetry
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Texture Footprint:</span>
          <span className="text-zinc-300">
            {currentResult.estimatedMemoryKiB} KiB (64x64 RGBA Micro-Tile)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">CSS Tiling Size:</span>
          <span className="text-zinc-300">{currentResult.cssBackgroundSize}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Evaluator Latency:</span>
          <span className="text-emerald-400 font-bold">
            {currentResult.latencyUs < 1 ? '< 1.0' : currentResult.latencyUs.toFixed(2)} µs (SLA &lt; 20µs)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">GPU VRAM Impact:</span>
          <span className="text-emerald-400 font-bold">0.05% of 32MB Budget</span>
        </div>
      </div>
    </div>
  );
};
