/**
 * KuraScroll - Sprint 122: Contrast-Adaptive Subpixel Unsharp Mask & Micro-Sharpening Synthesizer HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure zero-allocation 5-point cross stencil contrast-adaptive unsharp mask (CAS/USM).
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useUnsharpMask,
  UNSHARP_MASK_PRESETS,
  UnsharpMaskPresetName,
} from '../../reader/useUnsharpMask';

interface UnsharpMaskHUDProps {
  seriesId: string;
}

export const UnsharpMaskHUD: React.FC<UnsharpMaskHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    sharpness,
    setSharpness,
    edgeThreshold,
    setEdgeThreshold,
    haloClamp,
    setHaloClamp,
    isEnabled,
    setIsEnabled,
    sampleStencil,
    setSampleStencil,
    currentResult,
    selectPreset,
  } = useUnsharpMask(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-256 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Unsharp Mask Sharpening HUD (Hotkey: U)"
      >
        Unsharp Mask [U]
      </button>
    );
  }

  const weightPct = Math.round((currentResult.weight / 0.50) * 100);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="unsharp-mask-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-emerald-400">Unsharp Mask Sharpening</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 86
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: U)"
          >
            ×
          </button>
        </div>
      </div>

      {/* 3x3 Cross Stencil Visualizer */}
      <div className="mb-3 p-2.5 rounded bg-zinc-950 border border-zinc-800">
        <div className="flex justify-between items-center mb-2 text-[11px] text-zinc-400">
          <span>5-Point Cross Stencil</span>
          <span className="text-emerald-400 font-semibold">
            In: {sampleStencil.center} → Out: {currentResult.outValue} (Δ: {currentResult.outValue - sampleStencil.center})
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 w-36 mx-auto text-center font-bold text-[10px]">
          {/* Top Row: empty, North, empty */}
          <div className="p-1 rounded bg-zinc-900 border border-zinc-800 opacity-20">-</div>
          <div className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
            N:{sampleStencil.north}
          </div>
          <div className="p-1 rounded bg-zinc-900 border border-zinc-800 opacity-20">-</div>

          {/* Middle Row: West, Center, East */}
          <div className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
            W:{sampleStencil.west}
          </div>
          <div className="p-1 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 shadow-sm">
            C:{sampleStencil.center}
          </div>
          <div className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
            E:{sampleStencil.east}
          </div>

          {/* Bottom Row: empty, South, empty */}
          <div className="p-1 rounded bg-zinc-900 border border-zinc-800 opacity-20">-</div>
          <div className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
            S:{sampleStencil.south}
          </div>
          <div className="p-1 rounded bg-zinc-900 border border-zinc-800 opacity-20">-</div>
        </div>
      </div>

      {/* Adaptive Weight & Halo Suppression Status */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Adaptive Weight</span>
            <span className="text-emerald-400 font-semibold">{currentResult.weight.toFixed(3)}</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, weightPct)}%` }}
            />
          </div>
        </div>

        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Anti-Halo Ringing Guard</span>
            <span
              className={`font-semibold ${
                currentResult.haloSuppressed ? 'text-amber-400' : 'text-zinc-500'
              }`}
            >
              {currentResult.haloSuppressed ? 'CLAMPED' : 'CLEAR'}
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                currentResult.haloSuppressed ? 'bg-amber-400' : 'bg-zinc-700'
              }`}
              style={{ width: currentResult.haloSuppressed ? '100%' : '15%' }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-2 mb-3">
        {/* Sharpness Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Sharpness Amount</span>
            <span className="text-zinc-300">{sharpness.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0"
            max="2.0"
            step="0.05"
            value={sharpness}
            onChange={(e) => setSharpness(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Edge Threshold Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Edge Noise Cutoff Threshold</span>
            <span className="text-zinc-300">{edgeThreshold.toFixed(0)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={edgeThreshold}
            onChange={(e) => setEdgeThreshold(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Halo Clamp Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Halo Clamp Margin</span>
            <span className="text-zinc-300">{(haloClamp * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.25"
            step="0.01"
            value={haloClamp}
            onChange={(e) => setHaloClamp(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1">Preset Profile</label>
        <select
          value={presetName}
          onChange={(e) => selectPreset(e.target.value as UnsharpMaskPresetName)}
          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
        >
          {Object.entries(UNSHARP_MASK_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-zinc-500">
          {UNSHARP_MASK_PRESETS[presetName]?.description}
        </p>
      </div>

      {/* Latency Footprint */}
      <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-500">
        <span>Intel T4500 Zero-Allocation</span>
        <span className="text-emerald-400 font-semibold">
          {currentResult.latencyUs.toFixed(2)} µs (SLA &lt; 20 µs)
        </span>
      </div>
    </div>
  );
};
