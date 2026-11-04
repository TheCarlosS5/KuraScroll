/**
 * KuraScroll - Sprint 134: Dynamic Ink Splatter & Bleed Feathering Physics HUD (SLA 98)
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'Shift + S'
 */

import React, { useState, useMemo } from 'react';
import {
  useInkSplatter,
  InkSplatterPresetName,
  INK_SPLATTER_PRESETS,
  UseInkSplatterReturn,
} from '../../reader/useInkSplatter';

export interface InkSplatterHUDProps {
  seriesId?: string;
  controller?: UseInkSplatterReturn;
}

export const InkSplatterHUD: React.FC<InkSplatterHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useInkSplatter({ seriesId });
  const {
    profile,
    isHudOpen,
    setHudOpen,
    toggleHud,
    applyPreset,
    updateProfile,
    toggleEnabled,
    evaluateSplatter,
  } = externalController ?? localController;

  const [probeAngleDeg, setProbeAngleDeg] = useState(45);
  const [probeVelocity, setProbeVelocity] = useState(600);

  const probeResult = useMemo(() => {
    const angleRad = (probeAngleDeg * Math.PI) / 180;
    return evaluateSplatter(150, 150, angleRad, probeVelocity);
  }, [evaluateSplatter, probeAngleDeg, probeVelocity]);

  if (!isHudOpen) {
    return (
      <button
        type="button"
        onClick={() => setHudOpen(true)}
        className="fixed bottom-4 left-[54rem] z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Ink Splatter & Bleed Feathering HUD (Hotkey: Shift + S)"
      >
        <span className="text-rose-400 font-bold mr-1.5">INK SPLATTER</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">⇧S</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Dynamic Ink Splatter & Bleed Feathering Physics HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-rose-400 font-bold">INK SPLATTER</span>
          <span className="text-[10px] text-zinc-400">SLA 98</span>
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
            title="Close HUD (Shift + S)"
           aria-label="Cerrar">&times;</button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1 font-semibold">
          Splatter & Bleed Preset
        </label>
        <select
          value={profile.presetName}
          onChange={(e) => applyPreset(e.target.value as InkSplatterPresetName)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-rose-500"
        >
          {Object.values(INK_SPLATTER_PRESETS).map((p) => (
            <option key={p.name} value={p.name}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-zinc-500 mt-1 italic">
          {INK_SPLATTER_PRESETS[profile.presetName]?.description}
        </p>
      </div>

      {/* Param Sliders */}
      <div className="space-y-2 mb-3 border-t border-b border-zinc-800 py-2">
        {/* Stroke Velocity */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Stroke Velocity</span>
            <span className="text-rose-300">{profile.strokeVelocity.toFixed(0)} px/s</span>
          </div>
          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={profile.strokeVelocity}
            onChange={(e) => updateProfile({ strokeVelocity: parseFloat(e.target.value) })}
            className="w-full accent-rose-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Bleed Radius */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Capillary Bleed Radius</span>
            <span className="text-rose-300">{profile.bleedRadiusPx.toFixed(2)} px</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="5.0"
            step="0.05"
            value={profile.bleedRadiusPx}
            onChange={(e) => updateProfile({ bleedRadiusPx: parseFloat(e.target.value) })}
            className="w-full accent-rose-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Splatter Density */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Splatter Droplet Density</span>
            <span className="text-rose-300">{profile.splatterDensity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.02"
            value={profile.splatterDensity}
            onChange={(e) => updateProfile({ splatterDensity: parseFloat(e.target.value) })}
            className="w-full accent-rose-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Wicking Rate */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Paper Wicking Porosity</span>
            <span className="text-rose-300">{profile.wickingRate.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.02"
            value={profile.wickingRate}
            onChange={(e) => updateProfile({ wickingRate: parseFloat(e.target.value) })}
            className="w-full accent-rose-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Interactive Probe / Impact Test */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded p-2 mb-3">
        <div className="text-[10px] text-zinc-400 font-semibold mb-1">
          Dynamic Impact Ejection Probe
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <div className="flex justify-between text-[10px] text-zinc-500 mb-0.5">
              <span>Flick Angle:</span>
              <span className="text-rose-300">{probeAngleDeg}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={probeAngleDeg}
              onChange={(e) => setProbeAngleDeg(parseInt(e.target.value, 10))}
              className="w-full accent-rose-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-zinc-500 mb-0.5">
              <span>Impact Vel:</span>
              <span className="text-rose-300">{probeVelocity} px/s</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="20"
              value={probeVelocity}
              onChange={(e) => setProbeVelocity(parseInt(e.target.value, 10))}
              className="w-full accent-rose-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-zinc-800/60 p-1.5 rounded">
            <span className="text-zinc-500 block">Ejected Droplets:</span>
            <span className="text-zinc-200 font-mono font-semibold">
              {probeResult.dropletCount} micro-drops
            </span>
          </div>
          <div className="bg-zinc-800/60 p-1.5 rounded">
            <span className="text-zinc-500 block">Effective Bleed:</span>
            <span className="text-rose-300 font-mono font-semibold">
              {probeResult.effectiveBleed.toFixed(2)} px (+{(probeResult.wickingSpread * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Pen State:</span>
          <span className={`font-semibold ${probeResult.dropletCount > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
            {probeResult.dropletCount > 0 ? 'KINETIC EJECTION (Rayleigh-Plateau)' : 'RESTING MENISCUS (Static Drop)'}
          </span>
        </div>
      </div>

      {/* Footer / Telemetry */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[10px] text-zinc-500">
        <span>SLA 98 Target: &lt; 20 µs</span>
        <span className="text-emerald-400 font-mono">
          Eval: ~{probeResult.latencyUs.toFixed(2)} µs
        </span>
      </div>
    </div>
  );
};
