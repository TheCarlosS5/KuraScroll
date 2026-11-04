/**
 * KuraScroll - Sprint 121: Dynamic Atmospheric Vignette Shader & Depth-of-Field Aperture Simulator HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure zero-allocation analytical vignette falloff, smoothstep aperture, and DoF contrast simulation.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useVignetteAperture,
  VIGNETTE_APERTURE_PRESETS,
  VignettePresetName,
} from '../../reader/useVignetteAperture';

interface VignetteApertureHUDProps {
  seriesId: string;
}

export const VignetteApertureHUD: React.FC<VignetteApertureHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    innerRadius,
    setInnerRadius,
    outerRadius,
    setOuterRadius,
    vignetteStrength,
    setVignetteStrength,
    dofBlurFactor,
    setDofBlurFactor,
    focusXPct,
    setFocusXPct,
    focusYPct,
    setFocusYPct,
    isEnabled,
    setIsEnabled,
    currentResult,
    selectPreset,
  } = useVignetteAperture(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-236 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Vignette & Aperture DoF HUD (Hotkey: V)"
      >
        Vignette DoF [V]
      </button>
    );
  }

  const vignetteAlphaPct = Math.round(currentResult.vignetteAlpha * 100);
  const contrastPct = Math.round(currentResult.edgeContrast * 100);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="vignette-aperture-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-purple-400">Atmospheric Vignette &amp; DoF</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 85
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-purple-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: V)"
          >
            ×
          </button>
        </div>
      </div>

      {/* 2D Mini Viewport Reticle */}
      <div className="mb-3 p-2.5 rounded bg-zinc-950 border border-zinc-800">
        <div className="flex justify-between items-center mb-1 text-[11px] text-zinc-400">
          <span>Focal Aperture Reticle</span>
          <span className="text-purple-400 font-semibold">
            {focusXPct.toFixed(0)}% X | {focusYPct.toFixed(0)}% Y
          </span>
        </div>
        <div
          className="relative w-full h-24 bg-zinc-900 rounded border border-zinc-800 overflow-hidden cursor-crosshair"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
            const clickY = ((e.clientY - rect.top) / rect.height) * 100;
            setFocusXPct(Math.max(0, Math.min(100, clickX)));
            setFocusYPct(Math.max(0, Math.min(100, clickY)));
          }}
          title="Click to reposition focal center"
        >
          {/* Inner clear aperture ellipse */}
          <div
            className="absolute rounded-full border border-dashed border-emerald-500 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${focusXPct}%`,
              top: `${focusYPct}%`,
              width: `${Math.round(innerRadius * 70)}px`,
              height: `${Math.round(innerRadius * 50)}px`,
            }}
          />
          {/* Outer vignette boundary ellipse */}
          <div
            className="absolute rounded-full border border-zinc-700 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${focusXPct}%`,
              top: `${focusYPct}%`,
              width: `${Math.round(outerRadius * 70)}px`,
              height: `${Math.round(outerRadius * 50)}px`,
            }}
          />
          {/* Focal reticle point */}
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-purple-400 border border-zinc-950 transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
            style={{ left: `${focusXPct}%`, top: `${focusYPct}%` }}
          />
        </div>
      </div>

      {/* Vignette Alpha & DoF Edge Contrast Meters */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Vignette Alpha</span>
            <span className="text-purple-400 font-semibold">{vignetteAlphaPct}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-75"
              style={{ width: `${Math.min(100, vignetteAlphaPct)}%` }}
            />
          </div>
        </div>

        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Edge Contrast</span>
            <span className="text-emerald-400 font-semibold">{contrastPct}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, contrastPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-2 mb-3">
        {/* Vignette strength */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Vignette Strength</span>
            <span className="text-zinc-300">{(vignetteStrength * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={vignetteStrength}
            onChange={(e) => setVignetteStrength(parseFloat(e.target.value))}
            className="w-full accent-purple-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Aperture inner radius */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Inner Clear Aperture</span>
            <span className="text-zinc-300">{(innerRadius * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.95"
            step="0.05"
            value={innerRadius}
            onChange={(e) => setInnerRadius(parseFloat(e.target.value))}
            className="w-full accent-purple-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* DoF Blur / Contrast Attenuation Factor */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">DoF Edge Softening</span>
            <span className="text-zinc-300">{(dofBlurFactor * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={dofBlurFactor}
            onChange={(e) => setDofBlurFactor(parseFloat(e.target.value))}
            className="w-full accent-purple-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1">Preset Profile</label>
        <select
          value={presetName}
          onChange={(e) => selectPreset(e.target.value as VignettePresetName)}
          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-purple-500"
        >
          {Object.entries(VIGNETTE_APERTURE_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-zinc-500">
          {VIGNETTE_APERTURE_PRESETS[presetName]?.description}
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
