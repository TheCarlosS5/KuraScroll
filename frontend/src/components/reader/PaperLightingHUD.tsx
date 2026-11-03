/**
 * KuraScroll - Sprint 130: Subpixel Matte Paper Specular Reflection & Angular Lighting Modulator HUD
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'Shift + L'
 */

import React from 'react';
import {
  usePaperLighting,
  PaperLightingPresetName,
  PAPER_LIGHTING_PRESETS,
} from '../../reader/usePaperLighting';

export interface PaperLightingHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof usePaperLighting>;
}

export const PaperLightingHUD: React.FC<PaperLightingHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = usePaperLighting(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    lightX,
    setLightX,
    lightY,
    setLightY,
    lightZ,
    setLightZ,
    diffuseKd,
    setDiffuseKd,
    specularKs,
    setSpecularKs,
    roughness,
    setRoughness,
    inkAbsorption,
    setInkAbsorption,
    ambientKa,
    setAmbientKa,
    isEnabled,
    setIsEnabled,
    probeR,
    setProbeR,
    probeG,
    setProbeG,
    probeB,
    setProbeB,
    currentResult,
    applyPreset,
    saveProfile,
  } = externalController ?? localController;

  if (!isHUDOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 left-96 z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Paper Lighting & Reflection HUD (Hotkey: Shift + L)"
      >
        <span className="text-amber-400 font-bold mr-1.5">💡 LIGHTING</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">⇧L</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Subpixel Matte Paper Specular Reflection & Angular Lighting Modulator HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">💡 PAPER LIGHTING</span>
          <span className="text-[10px] text-zinc-400">SLA 94</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isEnabled ? 'bg-amber-950 text-amber-400 border border-amber-700' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1 text-sm font-bold"
            title="Close HUD (Shift+L)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Paper Material Preset</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(PAPER_LIGHTING_PRESETS) as PaperLightingPresetName[]).map((key) => {
            const p = PAPER_LIGHTING_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`px-2 py-1 text-left rounded text-[11px] truncate transition-colors ${
                  isSelected
                    ? 'bg-amber-900/60 text-amber-300 border border-amber-600 font-bold'
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

      {/* Lamp Position & Optics Sliders */}
      <div className="space-y-2 mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        {/* Lamp Height (Z) */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Lamp Altitude (Z):</span>
            <span className="text-amber-300 font-mono">{lightZ.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.20"
            max="3.00"
            step="0.10"
            value={lightZ}
            onChange={(e) => setLightZ(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Lamp Coordinates (X, Y) */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Light X:</span>
              <span className="text-amber-300 font-mono">{lightX.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.00"
              max="1.00"
              step="0.05"
              value={lightX}
              onChange={(e) => setLightX(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Light Y:</span>
              <span className="text-amber-300 font-mono">{lightY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.00"
              max="1.00"
              step="0.05"
              value={lightY}
              onChange={(e) => setLightY(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Diffuse & Specular Reflection */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Diffuse (k_d):</span>
              <span className="text-amber-300 font-mono">{diffuseKd.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="1.50"
              step="0.05"
              value={diffuseKd}
              onChange={(e) => setDiffuseKd(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Specular (k_s):</span>
              <span className="text-amber-300 font-mono">{specularKs.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.00"
              max="0.50"
              step="0.02"
              value={specularKs}
              onChange={(e) => setSpecularKs(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Roughness & Ink Absorption */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Roughness:</span>
              <span className="text-amber-300 font-mono">{roughness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.90"
              step="0.05"
              value={roughness}
              onChange={(e) => setRoughness(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Ink Absorb:</span>
              <span className="text-amber-300 font-mono">{(inkAbsorption * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.50"
              max="1.00"
              step="0.05"
              value={inkAbsorption}
              onChange={(e) => setInkAbsorption(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Interactive Probe Color Sample */}
      <div className="mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Live Color Probe</span>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded border border-zinc-600 shadow-inner flex-shrink-0"
            style={{ backgroundColor: `rgb(${probeR}, ${probeG}, ${probeB})` }}
            title="Input Sample Color"
          />
          <div className="flex-1 grid grid-cols-3 gap-1">
            <div>
              <span className="text-[9px] text-zinc-500 block">R: {probeR}</span>
              <input
                type="range"
                min="0"
                max="255"
                value={probeR}
                onChange={(e) => setProbeR(parseInt(e.target.value, 10))}
                className="w-full accent-red-500 h-1 bg-zinc-700 rounded appearance-none"
              />
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 block">G: {probeG}</span>
              <input
                type="range"
                min="0"
                max="255"
                value={probeG}
                onChange={(e) => setProbeG(parseInt(e.target.value, 10))}
                className="w-full accent-green-500 h-1 bg-zinc-700 rounded appearance-none"
              />
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 block">B: {probeB}</span>
              <input
                type="range"
                min="0"
                max="255"
                value={probeB}
                onChange={(e) => setProbeB(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 h-1 bg-zinc-700 rounded appearance-none"
              />
            </div>
          </div>
          <div
            className="w-8 h-8 rounded border border-zinc-600 shadow-inner flex-shrink-0"
            style={{
              backgroundColor: `rgb(${currentResult.outR}, ${currentResult.outG}, ${currentResult.outB})`,
            }}
            title="Lit Result Color"
          />
        </div>
      </div>

      {/* Telemetry Display */}
      <div className="mb-3 bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Diffuse / Specular:</span>
          <span className="text-amber-400 font-bold font-mono">
            {currentResult.diffuseIntensity.toFixed(3)} / {currentResult.specularIntensity.toFixed(3)}
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Ink Protection Guard:</span>
          <span className="text-zinc-300 font-mono">{(currentResult.inkGuard * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Output Color:</span>
          <span className="text-amber-300 font-mono font-bold">
            rgb({currentResult.outR}, {currentResult.outG}, {currentResult.outB})
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-zinc-800">
          <span className="text-zinc-500">SLA 94 Latency:</span>
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
          className="bg-amber-600 hover:bg-amber-500 text-black px-3 py-1 rounded text-[11px] font-bold transition-colors"
        >
          Save to Series
        </button>
        <span className="text-[10px] text-zinc-500">Intel T4500 Ready</span>
      </div>
    </div>
  );
};
