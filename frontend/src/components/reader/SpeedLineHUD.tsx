/**
 * KuraScroll - Sprint 125: Dynamic Speed-Line Vector Synthesizer & Kinetic Impact Focus Engine HUD
 * 
 * Hardware Profile: Intel Pentium T4500 (2C/2T) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'L' / 'l'
 */

import React, { useRef, useEffect } from 'react';
import {
  useSpeedLine,
  SpeedLinePresetName,
  SpeedLineMode,
  SPEED_LINE_PRESETS,
} from '../../reader/useSpeedLine';

export interface SpeedLineHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof useSpeedLine>;
}

export const SpeedLineHUD: React.FC<SpeedLineHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useSpeedLine(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    mode,
    setMode,
    lineCount,
    setLineCount,
    focusX,
    setFocusX,
    focusY,
    setFocusY,
    angleJitter,
    setAngleJitter,
    minLengthRatio,
    setMinLengthRatio,
    maxLengthRatio,
    setMaxLengthRatio,
    minWidthPx,
    setMinWidthPx,
    maxWidthPx,
    setMaxWidthPx,
    pulseDurationMs,
    setPulseDurationMs,
    isEnabled,
    setIsEnabled,
    buffer,
    pulseOutput,
    triggerPulse,
    selectPreset,
  } = externalController ?? localController;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas 2D interactive preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Solid background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    if (!isEnabled || buffer.count <= 0) {
      ctx.fillStyle = '#71717a';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPEED LINES DISABLED', w / 2, h / 2);
      return;
    }

    const coords = buffer.coordinates;
    const widths = buffer.widths;
    const opacities = buffer.opacities;
    const count = buffer.count;

    const intensity = pulseOutput.intensity;
    const lineScale = pulseOutput.lineScale;

    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const idx4 = i << 2;
      const x1 = coords[idx4] * w;
      const y1 = coords[idx4 + 1] * h;
      let x2 = coords[idx4 + 2] * w;
      let y2 = coords[idx4 + 3] * h;

      if (pulseOutput.isActive) {
        x2 = x1 + (x2 - x1) * lineScale;
        y2 = y1 + (y2 - y1) * lineScale;
      }

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }

    ctx.lineWidth = Math.min(3.0, (minWidthPx + maxWidthPx) * 0.5);
    ctx.globalAlpha = Math.min(1.0, 0.70 * intensity);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Draw focus point indicator
    const fx = focusX * w;
    const fy = focusY * h;
    ctx.fillStyle = pulseOutput.isActive ? '#ef4444' : '#eab308';
    ctx.beginPath();
    ctx.arc(fx, fy, pulseOutput.isActive ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }, [buffer, focusX, focusY, minWidthPx, maxWidthPx, pulseOutput, isEnabled]);

  if (!isHUDOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 left-4 z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Speed-Line Synthesizer HUD (Hotkey: L)"
      >
        <span className="text-amber-400 font-bold mr-1.5">SPEED-LINE</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">L</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Speed-Line Synthesizer HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">SPEED-LINE FOCUS</span>
          <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px]">
            SLA 89
          </span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">
            L
          </kbd>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1"
            title="Close (L)"
           aria-label="Cerrar">&times;</button>
        </div>
      </div>

      {/* Live Canvas Preview & Pulse Trigger */}
      <div className="flex gap-3 mb-3 bg-zinc-950 p-2.5 rounded border border-zinc-800 items-center">
        <canvas
          ref={canvasRef}
          width={100}
          height={100}
          className="border border-zinc-800 rounded bg-black shrink-0"
        />
        <div className="flex-1 flex flex-col justify-between h-full gap-1.5">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-zinc-400">Lines Rendered</span>
            <span className="text-amber-300 font-bold">{buffer.count}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-zinc-400">Mode</span>
            <span className="text-emerald-400 uppercase font-bold">{mode}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-zinc-400">Synthesis Latency</span>
            <span className="text-sky-400 font-mono">{buffer.latencyUs.toFixed(2)} µs</span>
          </div>
          <button
            type="button"
            onClick={triggerPulse}
            className={`mt-1 py-1 px-2 rounded text-[11px] font-bold border transition-colors ${
              pulseOutput.isActive
                ? 'bg-red-950 border-red-500 text-red-200 animate-pulse'
                : 'bg-zinc-800 border-zinc-600 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            {pulseOutput.isActive ? 'IMPACT PULSING' : 'TRIGGER IMPACT PULSE'}
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-[10px] text-zinc-400 block mb-1 uppercase tracking-wider">
          Presets
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(SPEED_LINE_PRESETS) as SpeedLinePresetName[]).map((key) => {
            const p = SPEED_LINE_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={`text-left px-2 py-1 rounded text-[10px] border truncate transition-colors ${
                  isSelected
                    ? 'bg-amber-950 border-amber-500 text-amber-200 font-bold'
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

      {/* Sliders & Controls */}
      <div className="space-y-2 mb-3 bg-zinc-900/60 p-2 rounded border border-zinc-800/80">
        {/* Line Count Slider */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Line Density: {lineCount}</span>
          <input
            type="range"
            min={0}
            max={256}
            step={8}
            value={lineCount}
            onChange={(e) => setLineCount(Number(e.target.value))}
            className="w-32 accent-amber-500"
          />
        </div>

        {/* Focus Coordinates */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Focus Core (X, Y): {focusX.toFixed(2)}, {focusY.toFixed(2)}</span>
          <div className="flex gap-1">
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={focusX}
              onChange={(e) => setFocusX(Number(e.target.value))}
              className="w-16 accent-amber-500"
              title="Focus X"
            />
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={focusY}
              onChange={(e) => setFocusY(Number(e.target.value))}
              className="w-16 accent-amber-500"
              title="Focus Y"
            />
          </div>
        </div>

        {/* Angular Jitter */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Angle Jitter: {angleJitter.toFixed(3)}</span>
          <input
            type="range"
            min={0.0}
            max={0.50}
            step={0.005}
            value={angleJitter}
            onChange={(e) => setAngleJitter(Number(e.target.value))}
            className="w-32 accent-amber-500"
          />
        </div>

        {/* Stroke Width Range */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Width Range: {minWidthPx.toFixed(1)} - {maxWidthPx.toFixed(1)} px</span>
          <div className="flex gap-1">
            <input
              type="range"
              min={0.1}
              max={5.0}
              step={0.1}
              value={minWidthPx}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMinWidthPx(val);
                if (val > maxWidthPx) setMaxWidthPx(val);
              }}
              className="w-16 accent-amber-500"
              title="Min Width"
            />
            <input
              type="range"
              min={0.1}
              max={10.0}
              step={0.1}
              value={maxWidthPx}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxWidthPx(val);
                if (val < minWidthPx) setMinWidthPx(val);
              }}
              className="w-16 accent-amber-500"
              title="Max Width"
            />
          </div>
        </div>

        {/* Pulse Duration */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Pulse Decay: {pulseDurationMs} ms</span>
          <input
            type="range"
            min={100}
            max={1000}
            step={20}
            value={pulseDurationMs}
            onChange={(e) => setPulseDurationMs(Number(e.target.value))}
            className="w-32 accent-amber-500"
          />
        </div>
      </div>

      {/* Mode & Enable Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
        <div className="flex gap-1">
          {(['radial', 'parallel', 'none'] as SpeedLineMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 text-[10px] rounded uppercase font-bold border transition-colors ${
                mode === m
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="accent-amber-500 rounded"
          />
          <span className="text-zinc-300">Enabled</span>
        </label>
      </div>
    </div>
  );
};
