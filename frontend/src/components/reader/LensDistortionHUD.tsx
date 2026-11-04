/**
 * KuraScroll - Sprint 126: Subpixel Chromatic Aberration & Lens Distortion Compensator HUD
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'C' / 'c'
 */

import React, { useRef, useEffect } from 'react';
import {
  useLensDistortion,
  LensDistortionPresetName,
  LENS_DISTORTION_PRESETS,
} from '../../reader/useLensDistortion';

export interface LensDistortionHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof useLensDistortion>;
}

export const LensDistortionHUD: React.FC<LensDistortionHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useLensDistortion(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    k1,
    setK1,
    k2,
    setK2,
    redShift,
    setRedShift,
    blueShift,
    setBlueShift,
    scale,
    setScale,
    isEnabled,
    setIsEnabled,
    probeX,
    setProbeX,
    probeY,
    setProbeY,
    currentResult,
    selectPreset,
  } = externalController ?? localController;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas 2D deformation mesh preview
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
      ctx.fillText('DISTORTION BYPASSED', w / 2, h / 2);
      return;
    }

    // Draw 6x6 deformed mesh lines
    const steps = 6;
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;

    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const v = j / 20;
        const xn = u - 0.5;
        const yn = v - 0.5;
        const r2 = xn * xn + yn * yn;
        const r4 = r2 * r2;
        const d = 1.0 + k1 * r2 + k2 * r4;
        const px = (0.5 + xn * d * scale) * w;
        const py = (0.5 + yn * d * scale) * h;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const v = j / 20;
        const xn = v - 0.5;
        const yn = u - 0.5;
        const r2 = xn * xn + yn * yn;
        const r4 = r2 * r2;
        const d = 1.0 + k1 * r2 + k2 * r4;
        const px = (0.5 + xn * d * scale) * w;
        const py = (0.5 + yn * d * scale) * h;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Draw probe point indicator
    const px = currentResult.correctedX * w;
    const py = currentResult.correctedY * h;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [k1, k2, scale, currentResult, isEnabled]);

  if (!isHUDOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 left-36 z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Lens Distortion & Chromatic Aberration HUD (Hotkey: C)"
      >
        <span className="text-cyan-400 font-bold mr-1.5">OPTICS</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">C</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Lens Distortion & Chromatic Compensator HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold text-sm">OPTICAL LENS & CHROMA</span>
          <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px]">
            SLA 90
          </span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">
            C
          </kbd>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1"
            title="Close (C)"
           aria-label="Cerrar">&times;</button>
        </div>
      </div>

      {/* Mesh Canvas & Chromatic Channels */}
      <div className="flex gap-3 mb-3 bg-zinc-950 p-2.5 rounded border border-zinc-800 items-center">
        <canvas
          ref={canvasRef}
          width={100}
          height={100}
          className="border border-zinc-800 rounded bg-black shrink-0"
        />
        <div className="flex-1 flex flex-col justify-between h-full gap-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-red-400">Red Shift (Q=4)</span>
            <span className="text-red-300 font-mono font-bold">
              {currentResult.redOffsetX > 0 ? `+${currentResult.redOffsetX.toFixed(2)}` : currentResult.redOffsetX.toFixed(2)} px
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-emerald-400">Green (Base)</span>
            <span className="text-emerald-300 font-mono font-bold">0.00 px</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-sky-400">Blue Shift (Q=4)</span>
            <span className="text-sky-300 font-mono font-bold">
              {currentResult.blueOffsetX > 0 ? `+${currentResult.blueOffsetX.toFixed(2)}` : currentResult.blueOffsetX.toFixed(2)} px
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] pt-1 border-t border-zinc-800">
            <span className="text-zinc-400">Distortion Factor</span>
            <span className="text-amber-300 font-bold">{currentResult.distortionFactor.toFixed(4)}x</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-zinc-400">Evaluation Latency</span>
            <span className="text-sky-400 font-mono">{currentResult.latencyUs.toFixed(2)} µs</span>
          </div>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-[10px] text-zinc-400 block mb-1 uppercase tracking-wider">
          Optical Presets
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(LENS_DISTORTION_PRESETS) as LensDistortionPresetName[]).map((key) => {
            const p = LENS_DISTORTION_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={`text-left px-2 py-1 rounded text-[10px] border truncate transition-colors ${
                  isSelected
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title={p.description}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders & Parameters */}
      <div className="space-y-2 mb-3 bg-zinc-900/60 p-2 rounded border border-zinc-800/80">
        {/* Radial Distortion k1 */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Radial Barrel (k1): {k1.toFixed(3)}</span>
          <input
            type="range"
            min={-0.10}
            max={0.10}
            step={0.005}
            value={k1}
            onChange={(e) => setK1(Number(e.target.value))}
            className="w-32 accent-cyan-500"
          />
        </div>

        {/* Radial Distortion k2 */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Higher-Order (k2): {k2.toFixed(4)}</span>
          <input
            type="range"
            min={-0.02}
            max={0.02}
            step={0.001}
            value={k2}
            onChange={(e) => setK2(Number(e.target.value))}
            className="w-32 accent-cyan-500"
          />
        </div>

        {/* Lateral Red / Blue Shift */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Lateral Chroma (R, B): {redShift.toFixed(3)}, {blueShift.toFixed(3)}</span>
          <div className="flex gap-1">
            <input
              type="range"
              min={-0.02}
              max={0.02}
              step={0.002}
              value={redShift}
              onChange={(e) => setRedShift(Number(e.target.value))}
              className="w-16 accent-red-500"
              title="Red Shift"
            />
            <input
              type="range"
              min={-0.02}
              max={0.02}
              step={0.002}
              value={blueShift}
              onChange={(e) => setBlueShift(Number(e.target.value))}
              className="w-16 accent-sky-500"
              title="Blue Shift"
            />
          </div>
        </div>

        {/* Geometry Scale Compensator */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Edge Scale: {scale.toFixed(2)}x</span>
          <input
            type="range"
            min={0.90}
            max={1.10}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-32 accent-cyan-500"
          />
        </div>

        {/* Probe Coordinates */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Probe Point (X, Y): {probeX.toFixed(2)}, {probeY.toFixed(2)}</span>
          <div className="flex gap-1">
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={probeX}
              onChange={(e) => setProbeX(Number(e.target.value))}
              className="w-16 accent-cyan-500"
              title="Probe X"
            />
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={probeY}
              onChange={(e) => setProbeY(Number(e.target.value))}
              className="w-16 accent-cyan-500"
              title="Probe Y"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
        <span className="text-[10px] text-zinc-500">Zero Math.sqrt · Q=4 Subpixel</span>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="accent-cyan-500 rounded"
          />
          <span className="text-zinc-300">Enabled</span>
        </label>
      </div>
    </div>
  );
};
