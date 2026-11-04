/**
 * KuraScroll - Sprint 128: Perceptual Color Gamut Mapping & CMYK Ink Density Simulator HUD
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'Shift + C'
 */

import React from 'react';
import {
  useCmykSimulator,
  CmykSimulatorPresetName,
  CMYK_SIMULATOR_PRESETS,
} from '../../reader/useCmykSimulator';

export interface CmykSimulatorHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof useCmykSimulator>;
}

export const CmykSimulatorHUD: React.FC<CmykSimulatorHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useCmykSimulator(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    tacLimit,
    setTacLimit,
    dotGain,
    setDotGain,
    blackAbsorption,
    setBlackAbsorption,
    gamutCompression,
    setGamutCompression,
    isEnabled,
    setIsEnabled,
    probeR,
    setProbeR,
    probeG,
    setProbeG,
    probeB,
    setProbeB,
    currentResult,
    selectPreset,
  } = externalController ?? localController;

  if (!isHUDOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 left-52 z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open CMYK Ink Density Simulator HUD (Hotkey: Shift + C)"
      >
        <span className="text-cyan-400 font-bold mr-1.5">CMYK</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">⇧C</kbd>
      </button>
    );
  }

  const tacPct = Math.round(currentResult.totalAreaCoverage * 100);
  const tacLimitPct = Math.round(tacLimit * 100);

  return (
    <div
      role="dialog"
      aria-label="CMYK Ink Density & Perceptual Gamut Simulator HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold">CMYK SIMULATOR</span>
          <span className="text-[10px] text-zinc-400">SLA 92</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isEnabled ? 'bg-cyan-950 text-cyan-400 border border-cyan-700' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1 font-bold"
            title="Close HUD (Shift+C)"
           aria-label="Cerrar">&times;</button>
        </div>
      </div>

      {/* 4 Ink Channels Meters */}
      <div className="mb-3 bg-zinc-950 border border-zinc-800 rounded p-2 space-y-1.5">
        <span className="text-zinc-400 text-[10px] block mb-1">PHYSICAL INK SEPARATION</span>
        
        {/* Cyan */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="w-12 text-cyan-400 font-bold">CYAN</span>
          <div className="flex-1 bg-zinc-850 h-2 rounded overflow-hidden bg-zinc-900 border border-zinc-800">
            <div
              className="bg-cyan-400 h-full"
              style={{ width: `${Math.min(100, currentResult.cyan * 100)}%` }}
            />
          </div>
          <span className="w-10 text-right text-zinc-300">{(currentResult.cyan * 100).toFixed(1)}%</span>
        </div>

        {/* Magenta */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="w-12 text-pink-400 font-bold">MAGENTA</span>
          <div className="flex-1 bg-zinc-850 h-2 rounded overflow-hidden bg-zinc-900 border border-zinc-800">
            <div
              className="bg-pink-500 h-full"
              style={{ width: `${Math.min(100, currentResult.magenta * 100)}%` }}
            />
          </div>
          <span className="w-10 text-right text-zinc-300">{(currentResult.magenta * 100).toFixed(1)}%</span>
        </div>

        {/* Yellow */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="w-12 text-yellow-400 font-bold">YELLOW</span>
          <div className="flex-1 bg-zinc-850 h-2 rounded overflow-hidden bg-zinc-900 border border-zinc-800">
            <div
              className="bg-yellow-400 h-full"
              style={{ width: `${Math.min(100, currentResult.yellow * 100)}%` }}
            />
          </div>
          <span className="w-10 text-right text-zinc-300">{(currentResult.yellow * 100).toFixed(1)}%</span>
        </div>

        {/* Black/Key */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="w-12 text-zinc-300 font-bold">KEY (K)</span>
          <div className="flex-1 bg-zinc-850 h-2 rounded overflow-hidden bg-zinc-900 border border-zinc-800">
            <div
              className="bg-zinc-400 h-full"
              style={{ width: `${Math.min(100, currentResult.black * 100)}%` }}
            />
          </div>
          <span className="w-10 text-right text-zinc-300">{(currentResult.black * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* TAC Coverage Meter */}
      <div className="mb-3 bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px]">
        <div className="flex justify-between mb-1">
          <span className="text-zinc-400">Total Area Coverage (TAC):</span>
          <span className={currentResult.isTacClamped ? 'text-amber-400 font-bold' : 'text-zinc-200'}>
            {tacPct}% / {tacLimitPct}% {currentResult.isTacClamped ? '(CLAMPED)' : '(OK)'}
          </span>
        </div>
        <div className="w-full bg-zinc-950 h-2 rounded overflow-hidden border border-zinc-800">
          <div
            className={`h-full ${currentResult.isTacClamped ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{ width: `${Math.min(100, (tacPct / 400) * 100)}%` }}
          />
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-zinc-400 text-[10px] block mb-1">PRINTING PROCESS PRESET</label>
        <select
          value={presetName}
          onChange={(e) => selectPreset(e.target.value as CmykSimulatorPresetName)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none"
        >
          {Object.values(CMYK_SIMULATOR_PRESETS).map((p) => (
            <option key={p.name} value={p.name}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Controls */}
      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">TAC Limit (Max Ink):</span>
            <span className="text-cyan-300 font-bold">{(tacLimit * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="1.50"
            max="4.00"
            step="0.10"
            value={tacLimit}
            onChange={(e) => setTacLimit(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 h-1 bg-zinc-800 rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Mechanical Dot Gain:</span>
            <span className="text-zinc-300 font-bold">{(dotGain * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.50"
            step="0.02"
            value={dotGain}
            onChange={(e) => setDotGain(parseFloat(e.target.value))}
            className="w-full accent-zinc-500 h-1 bg-zinc-800 rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">K-Absorption Bleed:</span>
            <span className="text-zinc-300 font-bold">{(blackAbsorption * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.50"
            step="0.02"
            value={blackAbsorption}
            onChange={(e) => setBlackAbsorption(parseFloat(e.target.value))}
            className="w-full accent-zinc-500 h-1 bg-zinc-800 rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Perceptual Gamut Compression:</span>
            <span className="text-pink-300 font-bold">{(gamutCompression * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.00"
            step="0.05"
            value={gamutCompression}
            onChange={(e) => setGamutCompression(parseFloat(e.target.value))}
            className="w-full accent-pink-500 h-1 bg-zinc-800 rounded"
          />
        </div>
      </div>

      {/* Live Probe Color Comparator */}
      <div className="pt-2 border-t border-zinc-800 mb-3">
        <span className="text-zinc-400 text-[10px] block mb-1">PROBE COLOR COMPARATOR</span>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {/* Input digital sRGB */}
          <div className="bg-zinc-950 border border-zinc-800 rounded p-1.5 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-zinc-700 shrink-0"
              style={{ backgroundColor: `rgb(${probeR}, ${probeG}, ${probeB})` }}
            />
            <div>
              <span className="text-zinc-400 block">Digital sRGB</span>
              <span className="text-zinc-200 font-mono text-[9px]">
                {probeR},{probeG},{probeB}
              </span>
            </div>
          </div>

          {/* Output simulated CMYK print */}
          <div className="bg-zinc-950 border border-zinc-800 rounded p-1.5 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-zinc-700 shrink-0"
              style={{ backgroundColor: `rgb(${currentResult.outR}, ${currentResult.outG}, ${currentResult.outB})` }}
            />
            <div>
              <span className="text-cyan-400 block font-bold">CMYK Print</span>
              <span className="text-zinc-200 font-mono text-[9px]">
                {currentResult.outR},{currentResult.outG},{currentResult.outB}
              </span>
            </div>
          </div>
        </div>
        
        {/* RGB probe sliders */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div>
            <span className="text-red-400 text-[9px]">R: {probeR}</span>
            <input
              type="range"
              min="0"
              max="255"
              value={probeR}
              onChange={(e) => setProbeR(parseInt(e.target.value, 10))}
              className="w-full accent-red-500 h-1 bg-zinc-800 rounded"
            />
          </div>
          <div>
            <span className="text-green-400 text-[9px]">G: {probeG}</span>
            <input
              type="range"
              min="0"
              max="255"
              value={probeG}
              onChange={(e) => setProbeG(parseInt(e.target.value, 10))}
              className="w-full accent-green-500 h-1 bg-zinc-800 rounded"
            />
          </div>
          <div>
            <span className="text-blue-400 text-[9px]">B: {probeB}</span>
            <input
              type="range"
              min="0"
              max="255"
              value={probeB}
              onChange={(e) => setProbeB(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 h-1 bg-zinc-800 rounded"
            />
          </div>
        </div>
      </div>

      {/* Latency display */}
      <div className="bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] flex justify-between">
        <span className="text-zinc-400">Pentium T4500 Evaluation Latency:</span>
        <span className="text-cyan-400 font-bold">{currentResult.latencyUs.toFixed(2)} µs</span>
      </div>
    </div>
  );
};
