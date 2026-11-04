/**
 * KuraScroll - Sprint 123: Adaptive Dynamic Range (ADR) Tone Equalizer & Black-Crush Compensator HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure zero-allocation 3-segment piecewise tone curve for black-crush compensation & dynamic range expansion.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useADRTone,
  ADR_TONE_PRESETS,
  ADRPresetName,
  localCalculateADRTone,
} from '../../reader/useADRTone';

interface ADRToneHUDProps {
  seriesId: string;
}

export const ADRToneHUD: React.FC<ADRToneHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    shadowLift,
    setShadowLift,
    gamma,
    setGamma,
    shoulderClamp,
    setShoulderClamp,
    whitePoint,
    isEnabled,
    setIsEnabled,
    sampleLuminance,
    setSampleLuminance,
    currentResult,
    selectPreset,
  } = useADRTone(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-276 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open ADR Tone Curve & Black-Crush HUD (Hotkey: R)"
      >
        ADR Tone [R]
      </button>
    );
  }

  // Generate 16 sample points for mini SVG tone curve
  const points: string[] = [];
  for (let i = 0; i <= 16; i++) {
    const inL = (i / 16) * 255;
    const r = localCalculateADRTone(inL, shadowLift, gamma, shoulderClamp, whitePoint, isEnabled);
    const x = (i / 16) * 160;
    const y = 80 - (r.outLuminance / 255) * 80;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const polylineStr = points.join(' ');

  const markerX = (sampleLuminance / 255) * 160;
  const markerY = 80 - (currentResult.outLuminance / 255) * 80;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="adr-tone-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-amber-400">ADR Tone &amp; Black-Crush Recovery</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 87
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
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: R)"
          >
            ×
          </button>
        </div>
      </div>

      {/* 2D Piecewise Tone Curve Graph */}
      <div className="mb-3 p-2.5 rounded bg-zinc-950 border border-zinc-800">
        <div className="flex justify-between items-center mb-1 text-[11px] text-zinc-400">
          <span>Piecewise Dynamic Range Transfer</span>
          <span className="text-amber-400 font-semibold">
            In: {sampleLuminance} → Out: {currentResult.outLuminance} (Δ: +{currentResult.liftDelta})
          </span>
        </div>
        <div className="relative w-full h-24 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-center p-2">
          <svg className="w-40 h-20 overflow-visible" viewBox="0 0 160 80">
            {/* Linear Reference 1:1 diagonal */}
            <line x1="0" y1="80" x2="160" y2="0" stroke="#3f3f46" strokeWidth="1" strokeDasharray="3,3" />
            {/* Tone curve polyline */}
            <polyline points={polylineStr} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            {/* Active sampled point marker */}
            <circle cx={markerX} cy={markerY} r="4" fill="#fbbf24" stroke="#18181b" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Shadow Lift & Shoulder Clamp Status */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Shadow Lift (Toe)</span>
            <span className="text-amber-400 font-semibold">{(shadowLift * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.round(shadowLift * 100))}%` }}
            />
          </div>
        </div>

        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Highlight Shoulder</span>
            <span className="text-emerald-400 font-semibold">{(shoulderClamp * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.round(shoulderClamp * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-2 mb-3">
        {/* Sample Input Luminance Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Test Input Shadow Luminance</span>
            <span className="text-zinc-300">{sampleLuminance} / 255</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            step="1"
            value={sampleLuminance}
            onChange={(e) => setSampleLuminance(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Shadow Lift Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Shadow Lift Strength</span>
            <span className="text-zinc-300">{(shadowLift * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.05"
            value={shadowLift}
            onChange={(e) => setShadowLift(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Gamma Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Midtone Gamma Exponent</span>
            <span className="text-zinc-300">{gamma.toFixed(2)}γ</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={gamma}
            onChange={(e) => setGamma(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1">Preset Profile</label>
        <select
          value={presetName}
          onChange={(e) => selectPreset(e.target.value as ADRPresetName)}
          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-amber-500"
        >
          {Object.entries(ADR_TONE_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-zinc-500">
          {ADR_TONE_PRESETS[presetName]?.description}
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
