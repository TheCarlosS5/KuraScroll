/**
 * KuraScroll - Sprint 127: Adaptive Moiré Pattern Suppressor & Halftone Screentone De-Aliasing HUD
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'M' / 'm'
 */

import React, { useRef, useEffect } from 'react';
import {
  useMoireSuppressor,
  MoireSuppressorPresetName,
  MOIRE_SUPPRESSOR_PRESETS,
} from '../../reader/useMoireSuppressor';

export interface MoireSuppressorHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof useMoireSuppressor>;
}

export const MoireSuppressorHUD: React.FC<MoireSuppressorHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useMoireSuppressor(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    suppressionStrength,
    setSuppressionStrength,
    deltaClamp,
    setDeltaClamp,
    edgeThreshold,
    setEdgeThreshold,
    filterRadius,
    setFilterRadius,
    isEnabled,
    setIsEnabled,
    probeCenterLum,
    setProbeCenterLum,
    probeLocalAvgLum,
    setProbeLocalAvgLum,
    probeDLdx,
    setProbeDLdx,
    probeDLdy,
    setProbeDLdy,
    probeAutocorrPeak,
    setProbeAutocorrPeak,
    currentResult,
    selectPreset,
  } = externalController ?? localController;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas 2D simulated periodic halftone de-aliasing preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    if (!isEnabled) {
      ctx.fillStyle = '#71717a';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MOIRÉ SUPPRESSION BYPASSED', w / 2, h / 2);
      return;
    }

    const midY = h / 2;

    // Draw grid baseline
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Draw raw oscillating halftone screentone waveform (red/zinc-400)
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const period = 8;
    for (let x = 0; x < w; x++) {
      const angle = (x / period) * Math.PI * 2;
      const rawOsc = Math.sin(angle) * 18 * probeAutocorrPeak;
      const y = midY + rawOsc;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw filtered de-aliased waveform (green/emerald-400)
    ctx.strokeStyle = currentResult.isEdgeProtected ? '#f59e0b' : '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const effectiveAtten = currentResult.isEdgeProtected
      ? 1.0
      : 1.0 - suppressionStrength * (1.0 - Math.min(1.0, currentResult.edgeStrength / edgeThreshold));

    for (let x = 0; x < w; x++) {
      const angle = (x / period) * Math.PI * 2;
      const filteredOsc = Math.sin(angle) * 18 * probeAutocorrPeak * effectiveAtten;
      const clampedOsc =
        Math.abs(filteredOsc) > deltaClamp ? Math.sign(filteredOsc) * deltaClamp : filteredOsc;
      const y = midY + clampedOsc;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Telemetry label on canvas
    ctx.fillStyle = currentResult.isEdgeProtected ? '#f59e0b' : '#34d399';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      currentResult.isEdgeProtected ? 'INK EDGE SHIELD ACTIVE' : `FILTERED: Δ ${currentResult.appliedDelta >= 0 ? '+' : ''}${currentResult.appliedDelta.toFixed(1)}`,
      w - 4,
      12
    );
  }, [
    suppressionStrength,
    deltaClamp,
    edgeThreshold,
    probeAutocorrPeak,
    currentResult,
    isEnabled,
  ]);

  if (!isHUDOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 left-44 z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Moiré Suppressor HUD (Hotkey: M)"
      >
        <span className="text-emerald-400 font-bold mr-1.5">MOIRÉ</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">M</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Adaptive Moiré Pattern Suppressor HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">MOIRÉ SUPPRESSOR</span>
          <span className="text-[10px] text-zinc-400">SLA 91</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1 font-bold"
            title="Close HUD (M)"
           aria-label="Cerrar">&times;</button>
        </div>
      </div>

      {/* Live Canvas Preview */}
      <div className="mb-3 bg-zinc-950 border border-zinc-800 rounded p-1 flex justify-center">
        <canvas
          ref={canvasRef}
          width={352}
          height={70}
          className="w-full h-[70px] block"
        />
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-zinc-400 text-[10px] block mb-1">DE-ALIASING PRESET</label>
        <select
          value={presetName}
          onChange={(e) => selectPreset(e.target.value as MoireSuppressorPresetName)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none"
        >
          {Object.values(MOIRE_SUPPRESSOR_PRESETS).map((p) => (
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
            <span className="text-zinc-400">Suppression Strength (S):</span>
            <span className="text-emerald-300 font-bold">{suppressionStrength.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={suppressionStrength}
            onChange={(e) => setSuppressionStrength(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Delta Clamp Limit (δ):</span>
            <span className="text-emerald-300 font-bold">±{deltaClamp.toFixed(1)} L</span>
          </div>
          <input
            type="range"
            min="0"
            max="64"
            step="1"
            value={deltaClamp}
            onChange={(e) => setDeltaClamp(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Edge Barrier Threshold (E):</span>
            <span className="text-amber-300 font-bold">{edgeThreshold.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="5"
            max="80"
            step="1"
            value={edgeThreshold}
            onChange={(e) => setEdgeThreshold(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-1 bg-zinc-800 rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Halftone Filter Radius (R):</span>
            <span className="text-zinc-300 font-bold">{filterRadius} px</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={filterRadius}
            onChange={(e) => setFilterRadius(parseInt(e.target.value, 10))}
            className="w-full accent-zinc-500 h-1 bg-zinc-800 rounded"
          />
        </div>
      </div>

      {/* Live Probe Inputs */}
      <div className="pt-2 border-t border-zinc-800 mb-3">
        <span className="text-zinc-400 text-[10px] block mb-1">PROBE TEST BENCH</span>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-zinc-500">Center Lum: </span>
            <input
              type="number"
              min="0"
              max="255"
              value={probeCenterLum}
              onChange={(e) => setProbeCenterLum(parseInt(e.target.value, 10) || 0)}
              className="w-16 bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-300"
            />
          </div>
          <div>
            <span className="text-zinc-500">Local Avg: </span>
            <input
              type="number"
              min="0"
              max="255"
              value={probeLocalAvgLum}
              onChange={(e) => setProbeLocalAvgLum(parseInt(e.target.value, 10) || 0)}
              className="w-16 bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-300"
            />
          </div>
          <div>
            <span className="text-zinc-500">Gradient dL/dx: </span>
            <input
              type="number"
              value={probeDLdx}
              onChange={(e) => setProbeDLdx(parseInt(e.target.value, 10) || 0)}
              className="w-16 bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-300"
            />
          </div>
          <div>
            <span className="text-zinc-500">Autocorr Peak: </span>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={probeAutocorrPeak}
              onChange={(e) => setProbeAutocorrPeak(parseFloat(e.target.value) || 0)}
              className="w-16 bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-300"
            />
          </div>
        </div>
      </div>

      {/* Live Telemetry Display */}
      <div className="bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] space-y-1">
        <div className="flex justify-between">
          <span className="text-zinc-400">Luminance In / Out:</span>
          <span className="text-zinc-200">
            {currentResult.originalLuminance} →{' '}
            <span className="text-emerald-400 font-bold">{currentResult.filteredLuminance}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Applied Delta:</span>
          <span className={currentResult.appliedDelta === 0 ? 'text-zinc-400' : 'text-emerald-400 font-bold'}>
            {currentResult.appliedDelta >= 0 ? '+' : ''}{currentResult.appliedDelta.toFixed(2)} L
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Ink Edge Barrier:</span>
          <span className={currentResult.isEdgeProtected ? 'text-amber-400 font-bold' : 'text-zinc-400'}>
            {currentResult.isEdgeProtected ? 'PROTECTED (E ≥ Threshold)' : `PASSIVE (E = ${currentResult.edgeStrength.toFixed(1)})`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Pentium T4500 Latency:</span>
          <span className="text-cyan-400 font-bold">{currentResult.latencyUs.toFixed(2)} µs</span>
        </div>
      </div>
    </div>
  );
};
