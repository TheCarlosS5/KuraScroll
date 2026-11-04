/**
 * KuraScroll - Sprint 132: Kinetic Scrolling Motion Deblur & Retinal Persistence Overdrive HUD
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz) & Intel GMA 4500MHD.
 * Pure solid background (#18181b), 0 CSS blur, 0 backdrop-filter, 0 CLS.
 * Hotkey: 'Shift + M'
 */

import React from 'react';
import {
  useMotionDeblur,
  MotionDeblurPresetName,
  MOTION_DEBLUR_PRESETS,
} from '../../reader/useMotionDeblur';

export interface MotionDeblurHUDProps {
  seriesId?: string;
  controller?: ReturnType<typeof useMotionDeblur>;
}

export const MotionDeblurHUD: React.FC<MotionDeblurHUDProps> = ({
  seriesId = 'default-series',
  controller: externalController,
}) => {
  const localController = useMotionDeblur(seriesId);
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    kod,
    setKod,
    vHalf,
    setVHalf,
    maxDelta,
    setMaxDelta,
    gammaFall,
    setGammaFall,
    gammaRise,
    setGammaRise,
    isEnabled,
    setIsEnabled,
    probeInL,
    setProbeInL,
    probePrevL,
    setProbePrevL,
    probeVelocity,
    setProbeVelocity,
    currentResult,
    applyPreset,
    saveProfile,
  } = externalController ?? localController;

  if (!isHUDOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 left-[38rem] z-40 bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded shadow hover:bg-zinc-800 transition-colors"
        title="Open Motion Deblur & Response Overdrive HUD (Hotkey: Shift + M)"
      >
        <span className="text-violet-400 font-bold mr-1.5">OVERDRIVE</span>
        <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-700">⇧M</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Kinetic Scrolling Motion Deblur & Retinal Persistence Overdrive HUD"
      className="fixed bottom-4 left-4 z-50 w-96 bg-[#18181b] border border-zinc-700 text-zinc-100 rounded-lg p-4 font-mono text-xs shadow-2xl select-none"
      style={{ contain: 'layout paint' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-violet-400 font-bold">MOTION OVERDRIVE</span>
          <span className="text-[10px] text-zinc-400">SLA 96</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isEnabled ? 'bg-violet-950 text-violet-400 border border-violet-700' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
          <button
            type="button"
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-400 hover:text-white px-1 text-sm font-bold"
            title="Close HUD (Shift+M)"
           aria-label="Cerrar">&times;</button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Overdrive Profile</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(MOTION_DEBLUR_PRESETS) as MotionDeblurPresetName[]).map((key) => {
            const p = MOTION_DEBLUR_PRESETS[key];
            const isSelected = presetName === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`px-2 py-1 text-left rounded text-[11px] truncate transition-colors ${
                  isSelected
                    ? 'bg-violet-900/60 text-violet-300 border border-violet-600 font-bold'
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

      {/* Overdrive Sliders */}
      <div className="space-y-2 mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        {/* Overdrive Gain (kod) */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Overdrive Gain (k_od):</span>
            <span className="text-violet-300 font-mono">{kod.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="2.5"
            step="0.05"
            value={kod}
            onChange={(e) => setKod(parseFloat(e.target.value))}
            className="w-full accent-violet-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Half-Speed Saturation (vHalf) */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Velocity Half-Point:</span>
            <span className="text-violet-300 font-mono">{vHalf.toFixed(0)} px/s</span>
          </div>
          <input
            type="range"
            min="200"
            max="1500"
            step="50"
            value={vHalf}
            onChange={(e) => setVHalf(parseFloat(e.target.value))}
            className="w-full accent-violet-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Max Impulse Clamp (maxDelta) */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Max Impulse Clamp:</span>
            <span className="text-violet-300 font-mono">±{maxDelta.toFixed(0)} L</span>
          </div>
          <input
            type="range"
            min="10"
            max="80"
            step="5"
            value={maxDelta}
            onChange={(e) => setMaxDelta(parseFloat(e.target.value))}
            className="w-full accent-violet-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Fall / Rise Gamma */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Fall (Darken):</span>
              <span className="text-violet-300 font-mono">{gammaFall.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.80"
              max="2.00"
              step="0.05"
              value={gammaFall}
              onChange={(e) => setGammaFall(parseFloat(e.target.value))}
              className="w-full accent-violet-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Rise (Brighten):</span>
              <span className="text-violet-300 font-mono">{gammaRise.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.80"
              max="2.00"
              step="0.05"
              value={gammaRise}
              onChange={(e) => setGammaRise(parseFloat(e.target.value))}
              className="w-full accent-violet-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Interactive Motion Probe */}
      <div className="mb-3 bg-zinc-900/70 p-2.5 rounded border border-zinc-800/80">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Live Velocity & Transition Probe</span>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
              <span>Scroll Velocity:</span>
              <span className="text-violet-300 font-mono">{probeVelocity.toFixed(0)} px/s</span>
            </div>
            <input
              type="range"
              min="0"
              max="3000"
              step="50"
              value={probeVelocity}
              onChange={(e) => setProbeVelocity(parseFloat(e.target.value))}
              className="w-full accent-violet-500 h-1 bg-zinc-700 rounded appearance-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
                <span>Prev Frame L:</span>
                <span className="text-zinc-300 font-mono">{probePrevL}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={probePrevL}
                onChange={(e) => setProbePrevL(parseInt(e.target.value, 10))}
                className="w-full accent-zinc-500 h-1 bg-zinc-700 rounded appearance-none"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5 text-zinc-400">
                <span>Current Target L:</span>
                <span className="text-zinc-300 font-mono">{probeInL}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={probeInL}
                onChange={(e) => setProbeInL(parseInt(e.target.value, 10))}
                className="w-full accent-zinc-500 h-1 bg-zinc-700 rounded appearance-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry Display */}
      <div className="mb-3 bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Overdrive Boost:</span>
          <span
            className={`font-mono font-bold ${
              currentResult.boost > 0
                ? 'text-emerald-400'
                : currentResult.boost < 0
                ? 'text-amber-400'
                : 'text-zinc-500'
            }`}
          >
            {currentResult.boost > 0 ? `+${currentResult.boost}` : currentResult.boost} L
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-zinc-400">Accelerated Output Luminance:</span>
          <span className="text-violet-300 font-mono font-bold">{currentResult.outL} / 255</span>
        </div>
        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-zinc-800">
          <span className="text-zinc-500">SLA 96 Latency:</span>
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
          className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-1 rounded text-[11px] font-bold transition-colors"
        >
          Save to Series
        </button>
        <span className="text-[10px] text-zinc-500">Intel T4500 Ready</span>
      </div>
    </div>
  );
};
