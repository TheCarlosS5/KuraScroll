/**
 * KuraScroll - Sprint 124: Subpixel Font Kerning & CJK Stroke Density Balancer HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure zero-allocation bitwise CJK range classification and analytical optical kerning evaluation.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useCJKKerning,
  CJK_KERNING_PRESETS,
  CJKPresetName,
} from '../../reader/useCJKKerning';

interface CJKKerningHUDProps {
  seriesId: string;
}

export const CJKKerningHUD: React.FC<CJKKerningHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    baseKerningEm,
    setBaseKerningEm,
    trackingRatio,
    setTrackingRatio,
    opticalWeightRatio,
    setOpticalWeightRatio,
    isEnabled,
    setIsEnabled,
    sampleChar,
    setSampleChar,
    currentResult,
    selectPreset,
  } = useCJKKerning(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-296 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open CJK Kerning & Stroke Density HUD (Hotkey: K)"
      >
        CJK Kerning [K]
      </button>
    );
  }

  const kerningEmVal = currentResult.kerningEm;
  const weightPct = Math.round(currentResult.opticalWeightRatio * 100);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="cjk-kerning-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-blue-400">CJK Kerning &amp; Stroke Density</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 88
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-blue-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: K)"
          >
            ×
          </button>
        </div>
      </div>

      {/* Glyph Preview Card with Dynamic Kerning & Stroke Weight */}
      <div className="mb-3 p-3 rounded bg-zinc-950 border border-zinc-800 text-center">
        <div className="flex justify-between items-center mb-1 text-[11px] text-zinc-400">
          <span className="capitalize">Block: {currentResult.densityType}</span>
          <span className="text-blue-400 font-semibold">
            Complexity: {currentResult.strokeComplexity.toFixed(1)} | {currentResult.cssLetterSpacing}
          </span>
        </div>
        <div
          className="my-2 py-3 bg-zinc-900 rounded border border-zinc-800 text-2xl font-serif text-zinc-100 transition-all select-all"
          style={{
            letterSpacing: currentResult.cssLetterSpacing,
            opacity: currentResult.opticalWeightRatio,
          }}
        >
          {sampleChar} 鬼 滅 の 刃 A!
        </div>
        <div className="flex justify-center items-center space-x-2 text-[11px]">
          <span className="text-zinc-400">Test Glyph:</span>
          <input
            type="text"
            value={sampleChar}
            maxLength={2}
            onChange={(e) => setSampleChar(e.target.value)}
            className="w-12 px-1 py-0.5 text-center bg-zinc-800 border border-zinc-700 rounded text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Optical Kerning & Stroke Compensation Meters */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Kerning Offset</span>
            <span className="text-blue-400 font-semibold">{kerningEmVal.toFixed(3)} em</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.max(10, Math.round((kerningEmVal + 0.05) * 400)))}%` }}
            />
          </div>
        </div>

        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Optical Weight</span>
            <span className="text-emerald-400 font-semibold">{weightPct}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, weightPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-2 mb-3">
        {/* Base Kerning Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Base Kerning Offset</span>
            <span className="text-zinc-300">{baseKerningEm.toFixed(3)} em</span>
          </div>
          <input
            type="range"
            min="-0.05"
            max="0.20"
            step="0.005"
            value={baseKerningEm}
            onChange={(e) => setBaseKerningEm(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Tracking Ratio Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Stroke Complexity Tracking Ratio</span>
            <span className="text-zinc-300">{trackingRatio.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.05"
            step="0.002"
            value={trackingRatio}
            onChange={(e) => setTrackingRatio(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Optical Weight Compensation Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Stroke Clumping Compensation</span>
            <span className="text-zinc-300">{(opticalWeightRatio * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.60"
            step="0.02"
            value={opticalWeightRatio}
            onChange={(e) => setOpticalWeightRatio(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1">Preset Profile</label>
        <select
          value={presetName}
          onChange={(e) => selectPreset(e.target.value as CJKPresetName)}
          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
        >
          {Object.entries(CJK_KERNING_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-zinc-500">
          {CJK_KERNING_PRESETS[presetName]?.description}
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
