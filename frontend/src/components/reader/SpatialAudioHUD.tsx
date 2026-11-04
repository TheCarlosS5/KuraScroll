/**
 * KuraScroll - Sprint 120: Spatial Audio Reverberation Occlusion & Distance Attenuation Engine HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure zero-allocation equal-power panning & logarithmic lowpass biquad attenuation.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useSpatialAudio,
  SPATIAL_AUDIO_PRESETS,
  SpatialAudioPresetName,
} from '../../reader/useSpatialAudio';

interface SpatialAudioHUDProps {
  seriesId: string;
}

export const SpatialAudioHUD: React.FC<SpatialAudioHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    referenceDistancePx,
    setReferenceDistancePx,
    rolloffFactor,
    setRolloffFactor,
    minGain,
    setMinGain,
    panRadiusPx,
    setPanRadiusPx,
    cutoffOpenHz,
    setCutoffOpenHz,
    cutoffClosedHz,
    setCutoffClosedHz,
    isEnabled,
    setIsEnabled,
    sourcePos,
    setSourcePos,
    listenerPos,
    setListenerPos,
    occlusionFactor,
    setOcclusionFactor,
    currentResult,
    selectPreset,
  } = useSpatialAudio(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-216 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Spatial Audio Reverb Occlusion HUD (Hotkey: O)"
      >
        Spatial Audio [O]
      </button>
    );
  }

  // Radar relative offset
  const dx = sourcePos.x - listenerPos.x;
  const dy = sourcePos.y - listenerPos.y;
  const radarScale = 0.15; // 1px = 0.15 radar units
  const radarCenterX = 80;
  const radarCenterY = 50;
  const sourceRadarX = Math.max(10, Math.min(150, radarCenterX + dx * radarScale));
  const sourceRadarY = Math.max(10, Math.min(90, radarCenterY + dy * radarScale));

  const leftGainPct = Math.round(currentResult.gainLeft * 100);
  const rightGainPct = Math.round(currentResult.gainRight * 100);
  const cutoffPct = Math.round(
    ((currentResult.cutoffHz - cutoffClosedHz) / Math.max(1, cutoffOpenHz - cutoffClosedHz)) * 100
  );

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="spatial-audio-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-cyan-400">Spatial Audio Engine</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 84
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: O)"
          >
            ×
          </button>
        </div>
      </div>

      {/* 2D Spatial Vector Radar */}
      <div className="mb-3 p-2.5 rounded bg-zinc-950 border border-zinc-800">
        <div className="flex justify-between items-center mb-1 text-[11px] text-zinc-400">
          <span>2D Acoustic Field Radar</span>
          <span className="text-cyan-400 font-semibold">
            {Math.round(currentResult.distancePx)}px | Pan: {currentResult.panning.toFixed(2)}
          </span>
        </div>
        <div className="relative w-full h-24 bg-zinc-900 rounded border border-zinc-800 overflow-hidden">
          {/* Radar center crosshair (Listener) */}
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 border border-zinc-950"
            style={{ left: `${radarCenterX - 5}px`, top: `${radarCenterY - 5}px` }}
            title="Listener (Viewport Focus)"
          />
          {/* Range rings */}
          <div
            className="absolute rounded-full border border-dashed border-zinc-700 pointer-events-none"
            style={{
              left: `${radarCenterX - 25}px`,
              top: `${radarCenterY - 25}px`,
              width: '50px',
              height: '50px',
            }}
          />
          <div
            className="absolute rounded-full border border-dashed border-zinc-800 pointer-events-none"
            style={{
              left: `${radarCenterX - 45}px`,
              top: `${radarCenterY - 45}px`,
              width: '90px',
              height: '90px',
            }}
          />
          {/* Audio Source Node */}
          <div
            className="absolute w-3 h-3 rounded-full bg-cyan-400 border border-zinc-950 cursor-pointer animate-pulse"
            style={{ left: `${sourceRadarX - 6}px`, top: `${sourceRadarY - 6}px` }}
            title="Audio Source (Dialogue Bubble)"
          />
          {/* Occlusion Barrier Indicator */}
          {occlusionFactor > 0.05 && (
            <div
              className="absolute h-10 w-1 bg-amber-500 rounded opacity-75"
              style={{
                left: `${(radarCenterX + sourceRadarX) / 2}px`,
                top: `${(radarCenterY + sourceRadarY) / 2 - 20}px`,
              }}
              title={`Gutter Occlusion Barrier (${Math.round(occlusionFactor * 100)}%)`}
            />
          )}
        </div>
      </div>

      {/* Stereo Gain & Lowpass Cutoff Meters */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Equal-Power Stereo</span>
            <span className="text-zinc-300">
              L: {leftGainPct}% | R: {rightGainPct}%
            </span>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${Math.min(100, leftGainPct)}%` }}
              />
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${Math.min(100, rightGainPct)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400">Biquad Cutoff</span>
            <span className="text-cyan-400 font-semibold">
              {Math.round(currentResult.cutoffHz)} Hz
            </span>
          </div>
          <div className="h-3 w-full bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{ width: `${Math.max(5, Math.min(100, cutoffPct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-2 mb-3">
        {/* Occlusion slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Panel Gutter Occlusion</span>
            <span className="text-zinc-300">{Math.round(occlusionFactor * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={occlusionFactor}
            onChange={(e) => setOcclusionFactor(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>

        {/* Source X panning slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-zinc-400">Source Horizontal Offset (X)</span>
            <span className="text-zinc-300">{sourcePos.x - listenerPos.x} px</span>
          </div>
          <input
            type="range"
            min="-400"
            max="400"
            step="20"
            value={sourcePos.x - listenerPos.x}
            onChange={(e) =>
              setSourcePos((prev) => ({
                ...prev,
                x: listenerPos.x + parseFloat(e.target.value),
              }))
            }
            className="w-full accent-cyan-500 h-1 bg-zinc-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-zinc-400 mb-1">Preset Profile</label>
        <select
          value={presetName}
          onChange={(e) => selectPreset(e.target.value as SpatialAudioPresetName)}
          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-cyan-500"
        >
          {Object.entries(SPATIAL_AUDIO_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-zinc-500">
          {SPATIAL_AUDIO_PRESETS[presetName]?.description}
        </p>
      </div>

      {/* Latency Footprint */}
      <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-500">
        <span>Intel T4500 Zero-Allocation</span>
        <span className="text-emerald-400 font-semibold">
          {currentResult.latencyUs.toFixed(2)} µs (SLA &lt; 20 µs)
        </span>
      </div>
    </div>
  );
};
