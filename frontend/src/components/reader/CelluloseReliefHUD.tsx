/**
 * KuraScroll - Sprint 133: Cellulose Fiber Micro-Relief & Paper Grain Texture HUD (SLA 97)
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'Shift + F'
 */

import React, { useState, useMemo } from 'react';
import {
  useCelluloseRelief,
  CelluloseReliefPresetName,
  CELLULOSE_RELIEF_PRESETS,
  UseCelluloseReliefReturn,
} from '../../reader/useCelluloseRelief';

export interface CelluloseReliefHUDProps {
  seriesId?: string;
  controller?: UseCelluloseReliefReturn;
}

export const CelluloseReliefHUD: React.FC<CelluloseReliefHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useCelluloseRelief({ seriesId });
  const {
    profile,
    isHudOpen,
    setHudOpen,
    toggleHud,
    applyPreset,
    updateProfile,
    toggleEnabled,
    evaluateRelief,
  } = externalController ?? localController;

  const [probeX, setProbeX] = useState(64);
  const [probeY, setProbeY] = useState(64);
  const [probeK, setProbeK] = useState(0.0);

  const probeResult = useMemo(() => {
    return evaluateRelief(probeX, probeY, probeK);
  }, [evaluateRelief, probeX, probeY, probeK]);

  if (!isHudOpen) {
    return (
      <button
        type="button"
        onClick={() => setHudOpen(true)}
        className="fixed bottom-4 left-[46rem] z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Cellulose Relief & Paper Texture HUD (Hotkey: Shift + F)"
      >
        <span className="text-amber-400 font-bold mr-1.5">📜 PAPER FIBER</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">⇧F</kbd>
      </button>
    );
  }

  const lightAngleDeg = Math.round((profile.lightAngle * 180) / Math.PI);

  return (
    <div
      role="dialog"
      aria-label="Cellulose Fiber Micro-Relief & Paper Grain Texture HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">📜 CELLULOSE RELIEF</span>
          <span className="text-[10px] text-zinc-400">SLA 97</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleEnabled}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              profile.isEnabled
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}
          >
            {profile.isEnabled ? 'ENABLED' : 'BYPASS'}
          </button>
          <button
            type="button"
            onClick={toggleHud}
            className="text-zinc-500 hover:text-zinc-300 text-sm leading-none px-1"
            title="Close HUD (Shift + F)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">
          Paper Substrate Preset
        </label>
        <select
          value={profile.presetName}
          onChange={(e) => applyPreset(e.target.value as CelluloseReliefPresetName)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-amber-500"
        >
          {Object.values(CELLULOSE_RELIEF_PRESETS).map((p) => (
            <option key={p.name} value={p.name}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-zinc-500 mt-1 italic">
          {CELLULOSE_RELIEF_PRESETS[profile.presetName]?.description}
        </p>
      </div>

      {/* Param Sliders */}
      <div className="space-y-2 mb-3 border-t border-b border-zinc-800 py-2">
        {/* Grain Scale */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Grain Scale</span>
            <span className="text-amber-300">{profile.grainScale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.05"
            value={profile.grainScale}
            onChange={(e) => updateProfile({ grainScale: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Relief Depth */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Relief Depth</span>
            <span className="text-amber-300">{profile.reliefDepth.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={profile.reliefDepth}
            onChange={(e) => updateProfile({ reliefDepth: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Fiber Density */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Fiber Density</span>
            <span className="text-amber-300">{profile.fiberDensity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={profile.fiberDensity}
            onChange={(e) => updateProfile({ fiberDensity: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Light Angle */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Grazing Light Angle</span>
            <span className="text-amber-300">{lightAngleDeg}° ({profile.lightAngle.toFixed(2)} rad)</span>
          </div>
          <input
            type="range"
            min="0.0"
            max={Math.PI / 2}
            step="0.02"
            value={profile.lightAngle}
            onChange={(e) => updateProfile({ lightAngle: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Interactive Probe / Live Ink Barrier Test */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded p-2 mb-3">
        <div className="text-[10px] text-zinc-400 font-semibold mb-1">
          Ink Absorption Barrier Probe
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-zinc-500">Black Ink Density (K):</span>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={probeK}
            onChange={(e) => setProbeK(parseFloat(e.target.value))}
            className="flex-1 accent-amber-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
          <span className="text-[10px] text-amber-300 w-8 text-right font-mono">
            {probeK.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-zinc-800/60 p-1.5 rounded">
            <span className="text-zinc-500 block">Diffuse Illum:</span>
            <span className="text-zinc-200 font-mono font-semibold">
              {(probeResult.diffuseLight * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bg-zinc-800/60 p-1.5 rounded">
            <span className="text-zinc-500 block">Effective Relief:</span>
            <span className={`font-mono font-semibold ${probeResult.effectiveRelief > 0 ? 'text-amber-300' : 'text-zinc-500'}`}>
              {(probeResult.effectiveRelief * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Surface State:</span>
          <span className={`font-semibold ${probeResult.isSuppressedByInk ? 'text-rose-400' : 'text-emerald-400'}`}>
            {probeResult.isSuppressedByInk ? 'INK-SEALED (Relief Suppressed)' : 'VIRGIN PAPER (Active Relief)'}
          </span>
        </div>
      </div>

      {/* Footer / Telemetry */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[10px] text-zinc-500">
        <span>SLA 97 Target: &lt; 20 µs</span>
        <span className="text-emerald-400 font-mono">
          Eval: ~{probeResult.latencyUs.toFixed(2)} µs
        </span>
      </div>
    </div>
  );
};
