/**
 * KuraScroll - Sprint 131: Subpixel Mechanical Rotary Press Plate Misregistration & Ink Trapping HUD
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'Shift + T'
 */

import React from 'react';
import {
  useInkTrapping,
  InkTrappingPresetName,
  InkTrappingMode,
  INK_TRAPPING_PRESETS,
} from '../../reader/useInkTrapping';

export interface InkTrappingHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof useInkTrapping>;
}

export const InkTrappingHUD: React.FC<InkTrappingHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useInkTrapping(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    shiftCx,
    setShiftCx,
    shiftCy,
    setShiftCy,
    shiftMx,
    setShiftMx,
    shiftMy,
    setShiftMy,
    shiftYx,
    setShiftYx,
    shiftYy,
    setShiftYy,
    trapWidth,
    setTrapWidth,
    trapMode,
    setTrapMode,
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
        className="fixed bottom-4 left-[30rem] z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Ink Trapping & Misregistration HUD (Hotkey: Shift + T)"
      >
        <span className="text-pink-400 font-bold mr-1.5">TRAPPING</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">⇧T</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Subpixel Mechanical Rotary Press Plate Misregistration & Ink Trapping HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-pink-400 font-bold">INK TRAPPING</span>
          <span className="text-[10px] text-zinc-400">SLA 95</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isEnabled ? 'bg-pink-950 text-pink-400 border border-pink-700' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1 text-sm font-bold"
            title="Close HUD (Shift+T)"
           aria-label="Cerrar">&times;</button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Rotary Press Profile</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(INK_TRAPPING_PRESETS) as InkTrappingPresetName[]).map((key) => {
            const p = INK_TRAPPING_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`px-2 py-1 text-left rounded text-[11px] truncate transition-colors ${
                  isSelected
                    ? 'bg-pink-900/60 text-pink-300 border border-pink-600 font-bold'
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

      {/* Trapping Mode Selector */}
      <div className="mb-3 bg-zinc-900/70 p-2 rounded border border-zinc-800/80">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-zinc-400 uppercase">Trapping Strategy</span>
          <span className="text-zinc-300 font-mono text-[10px]">{trapMode.toUpperCase()}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(['spread', 'choke', 'auto'] as InkTrappingMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTrapMode(mode)}
              className={`py-0.5 text-center rounded text-[10px] uppercase font-bold transition-colors ${
                trapMode === mode
                  ? 'bg-pink-950 text-pink-400 border border-pink-700'
                  : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Plate Shift Sliders */}
      <div className="space-y-2 mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        {/* Cyan Plate Offset */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-cyan-400">
              <span>Cyan ΔX:</span>
              <span className="font-mono">{shiftCx.toFixed(2)}px</span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.05"
              value={shiftCx}
              onChange={(e) => setShiftCx(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-cyan-400">
              <span>Cyan ΔY:</span>
              <span className="font-mono">{shiftCy.toFixed(2)}px</span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.05"
              value={shiftCy}
              onChange={(e) => setShiftCy(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Magenta Plate Offset */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-pink-400">
              <span>Magenta ΔX:</span>
              <span className="font-mono">{shiftMx.toFixed(2)}px</span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.05"
              value={shiftMx}
              onChange={(e) => setShiftMx(parseFloat(e.target.value))}
              className="w-full accent-pink-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-pink-400">
              <span>Magenta ΔY:</span>
              <span className="font-mono">{shiftMy.toFixed(2)}px</span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.05"
              value={shiftMy}
              onChange={(e) => setShiftMy(parseFloat(e.target.value))}
              className="w-full accent-pink-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Yellow Plate Offset */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-yellow-400">
              <span>Yellow ΔX:</span>
              <span className="font-mono">{shiftYx.toFixed(2)}px</span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.05"
              value={shiftYx}
              onChange={(e) => setShiftYx(parseFloat(e.target.value))}
              className="w-full accent-yellow-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-yellow-400">
              <span>Yellow ΔY:</span>
              <span className="font-mono">{shiftYy.toFixed(2)}px</span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.05"
              value={shiftYy}
              onChange={(e) => setShiftYy(parseFloat(e.target.value))}
              className="w-full accent-yellow-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Trapping Dilation Width */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Trapping Dilation Width:</span>
            <span className="text-pink-300 font-mono">{trapWidth.toFixed(2)} px</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.50"
            step="0.05"
            value={trapWidth}
            onChange={(e) => setTrapWidth(parseFloat(e.target.value))}
            className="w-full accent-pink-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Interactive Color Probe */}
      <div className="mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Live Edge Probe</span>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded border border-zinc-600 shadow-inner flex-shrink-0"
            style={{ backgroundColor: `rgb(${probeR}, ${probeG}, ${probeB})` }}
            title="Source Scanned Pixel"
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
            title="Trapped Misregistered Result"
          />
        </div>
      </div>

      {/* Telemetry Display */}
      <div className="mb-3 bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">CMYK Densities:</span>
          <span className="text-zinc-300 font-mono text-[10px]">
            C:{currentResult.cEff.toFixed(2)} M:{currentResult.mEff.toFixed(2)} Y:{currentResult.yEff.toFixed(2)} K:{currentResult.kEff.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Trapping Dilation:</span>
          <span className="text-pink-400 font-bold font-mono">
            {(currentResult.trapIntensity * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Result Color:</span>
          <span className="text-pink-300 font-mono font-bold">
            rgb({currentResult.outR}, {currentResult.outG}, {currentResult.outB})
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-zinc-800">
          <span className="text-zinc-500">SLA 95 Latency:</span>
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
          className="bg-pink-600 hover:bg-pink-500 text-black px-3 py-1 rounded text-[11px] font-bold transition-colors"
        >
          Save to Series
        </button>
        <span className="text-[10px] text-zinc-500">Intel T4500 Ready</span>
      </div>
    </div>
  );
};
