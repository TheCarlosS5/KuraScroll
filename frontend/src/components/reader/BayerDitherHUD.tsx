/**
 * KuraScroll - Sprint 119: Adaptive Subpixel Color De-Banding & Ordered Bayer Dither Matrix Synthesizer HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure zero-allocation bitwise Bayer matrix dithering for 6-bit TN LCD de-banding.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useBayerDither,
  BAYER_DITHER_PRESETS,
  BayerPresetName,
} from '../../reader/useBayerDither';

interface BayerDitherHUDProps {
  seriesId: string;
}

export const BayerDitherHUD: React.FC<BayerDitherHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    matrixSize,
    setMatrixSize,
    targetBits,
    setTargetBits,
    ditherStrength,
    setDitherStrength,
    edgeProtection,
    setEdgeProtection,
    isEnabled,
    setIsEnabled,
    sample,
    setSample,
    currentResult,
    selectPreset,
  } = useBayerDither(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-196 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Bayer Dither De-Banding HUD (Hotkey: B)"
      >
        Bayer Dither [B]
      </button>
    );
  }

  const cellsCount = matrixSize * matrixSize;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="bayer-dither-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-rose-400">Bayer Dither Matrix</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 83
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-rose-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: B)"
          >
            ×
          </button>
        </div>
      </div>

      {/* Bayer Matrix Spatial Radar */}
      <div className="mb-3 p-2.5 rounded bg-zinc-950 border border-zinc-800">
        <div className="flex justify-between items-center mb-1 text-[10px] text-zinc-400">
          <span>{matrixSize}×{matrixSize} Ordered Bayer Grid ({cellsCount} cells)</span>
          <span className="text-rose-400 font-bold">{targetBits}-bit Quantization ({1 << targetBits} levels)</span>
        </div>
        <div
          className="grid gap-0.5 w-full"
          style={{ gridTemplateColumns: `repeat(${matrixSize}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cellsCount }, (_, i) => {
            const row = Math.floor(i / matrixSize);
            const col = i % matrixSize;
            const isSample = (sample.x % matrixSize) === col && (sample.y % matrixSize) === row;
            return (
              <div
                key={i}
                className="w-full h-2 rounded-[1px] transition-colors"
                style={{
                  backgroundColor: isSample ? '#f43f5e' : `rgba(244, 63, 94, ${(i % 16) / 20 + 0.15})`,
                }}
                title={`Cell (${col}, ${row})`}
              />
            );
          })}
        </div>
      </div>

      {/* Telemetry Output */}
      <div className="p-2 mb-3 rounded bg-zinc-900 border border-zinc-800 space-y-1 text-[11px]">
        <div className="flex justify-between text-zinc-400">
          <span>Input RGB:</span>
          <span className="text-zinc-200 font-mono">rgb({sample.r}, {sample.g}, {sample.b})</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Dithered Output RGB:</span>
          <span className="text-rose-400 font-mono font-bold">
            rgb({currentResult.outR}, {currentResult.outG}, {currentResult.outB})
          </span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Effective Threshold Ts:</span>
          <span className="text-emerald-400 font-mono">{currentResult.threshold.toFixed(3)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Packed 24-bit Hex:</span>
          <span className="text-amber-400 font-mono">
            #{currentResult.packedRgb.toString(16).padStart(6, '0').toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Calculation Latency:</span>
          <span className="text-rose-400 font-mono">{currentResult.latencyUs.toFixed(2)} µs</span>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <div className="text-[11px] text-zinc-400 mb-1">Dither Preset:</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(BAYER_DITHER_PRESETS) as BayerPresetName[]).map((key) => {
            const preset = BAYER_DITHER_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                onClick={() => selectPreset(key)}
                className="px-2 py-1 rounded text-left border text-[10px] truncate transition-colors"
                style={{
                  backgroundColor: isSelected ? '#2a161d' : '#27272a',
                  borderColor: isSelected ? '#f43f5e' : '#3f3f46',
                  color: isSelected ? '#fda4af' : '#a1a1aa',
                }}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders & Controls */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Dither Strength:</span>
          <span className="text-rose-400 font-bold">{ditherStrength.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.00"
          max="1.00"
          step="0.05"
          value={ditherStrength}
          onChange={(e) => setDitherStrength(parseFloat(e.target.value))}
          className="w-full accent-rose-500 cursor-pointer h-1 bg-zinc-800 rounded"
        />

        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Edge Protection:</span>
          <span className="text-rose-400 font-bold">{edgeProtection.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.00"
          max="1.00"
          step="0.05"
          value={edgeProtection}
          onChange={(e) => setEdgeProtection(parseFloat(e.target.value))}
          className="w-full accent-rose-500 cursor-pointer h-1 bg-zinc-800 rounded"
        />
      </div>

      {/* Matrix Size & Test Coordinates */}
      <div className="flex space-x-1.5">
        <button
          onClick={() => setMatrixSize(4)}
          className={`flex-1 py-1 px-2 rounded border text-[10px] ${
            matrixSize === 4
              ? 'bg-rose-950 border-rose-800 text-rose-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}
        >
          4×4 Grid
        </button>
        <button
          onClick={() => setMatrixSize(8)}
          className={`flex-1 py-1 px-2 rounded border text-[10px] ${
            matrixSize === 8
              ? 'bg-rose-950 border-rose-800 text-rose-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}
        >
          8×8 Grid
        </button>
        <button
          onClick={() =>
            setSample({
              x: Math.floor(Math.random() * 8),
              y: Math.floor(Math.random() * 8),
              r: Math.floor(Math.random() * 256),
              g: Math.floor(Math.random() * 256),
              b: Math.floor(Math.random() * 256),
            })
          }
          className="py-1 px-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-[10px]"
          title="Sample random pixel"
        >
          Random
        </button>
      </div>
    </div>
  );
};
