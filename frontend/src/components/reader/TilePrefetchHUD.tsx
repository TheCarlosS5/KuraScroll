/**
 * KuraScroll - Sprint 117: Predictive Subpixel Canvas Tile Cache Prefetcher & LRU Texture Swapper HUD
 * 
 * Hardware Target: Intel Pentium T4500 & Intel GMA 4500MHD.
 * Pure TypedArray ring-buffer LRU telemetry with sub-microsecond Markov prefetch tracking.
 * Strict zero-blur containment (#18181b), 0 CLS, solid styling.
 */

import React from 'react';
import {
  useTilePrefetch,
  TILE_PREFETCH_PRESETS,
  ReadingFlow,
  RING_CAPACITY,
} from '../../reader/useTilePrefetch';

interface TilePrefetchHUDProps {
  seriesId: string;
}

export const TilePrefetchHUD: React.FC<TilePrefetchHUDProps> = ({ seriesId }) => {
  const {
    isHUDOpen,
    setIsHUDOpen,
    readingFlow,
    predictionHorizonMs,
    setPredictionHorizonMs,
    hysteresisThreshold,
    setHysteresisThreshold,
    isEnabled,
    setIsEnabled,
    ringSlots,
    cachedCount,
    lastDecision,
    telemetry,
    hitRatio,
    evaluateCandidate,
    resetRing,
    selectPreset,
  } = useTilePrefetch(seriesId);

  if (!isHUDOpen) {
    return (
      <button
        onClick={() => setIsHUDOpen(true)}
        className="fixed bottom-4 right-140 z-40 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors shadow-none"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
        title="Open Tile Prefetcher HUD (Hotkey: P)"
      >
        ⚡ Tile Prefetch [P]
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 p-4 rounded border text-xs font-mono select-none"
      style={{
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        color: '#f4f4f5',
        boxShadow: 'none',
      }}
      data-testid="tile-prefetch-hud"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: '#27272a' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-emerald-400">⚡ Tile Prefetch & LRU</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            SLA 81
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => setIsHUDOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 leading-none text-base"
            title="Close (Hotkey: P)"
          >
            ×
          </button>
        </div>
      </div>

      {/* 64-Slot Ring Buffer Radar Grid */}
      <div className="mb-3 p-2 rounded bg-zinc-950 border border-zinc-800">
        <div className="flex justify-between items-center mb-1 text-[10px] text-zinc-400">
          <span>64-Slot Ring Buffer Radar</span>
          <span>{cachedCount} / {RING_CAPACITY} Slots ({((cachedCount / RING_CAPACITY) * 100).toFixed(0)}%)</span>
        </div>
        <div className="grid grid-cols-16 gap-0.5 w-full">
          {ringSlots.map((slot) => {
            let bg = '#27272a'; // Empty
            if (slot.tileId !== -1) {
              bg = slot.isPinned ? '#06b6d4' : '#10b981'; // Pinned vs Cached
            }
            if (lastDecision && lastDecision.slotIndex === slot.slot) {
              bg = '#f59e0b'; // Just touched / target
            }
            return (
              <div
                key={slot.slot}
                className="w-full h-2 rounded-[1px] transition-colors"
                style={{ backgroundColor: bg }}
                title={`Slot ${slot.slot}: ${slot.tileId !== -1 ? `Tile #${slot.tileId}` : 'Empty'}`}
              />
            );
          })}
        </div>
      </div>

      {/* Flow Mode Presets */}
      <div className="mb-3">
        <div className="text-[11px] text-zinc-400 mb-1">Reading Flow Preset:</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(TILE_PREFETCH_PRESETS) as ReadingFlow[]).map((flow) => {
            const preset = TILE_PREFETCH_PRESETS[flow];
            const isSelected = readingFlow === flow;
            return (
              <button
                key={flow}
                onClick={() => selectPreset(flow)}
                className="px-2 py-1 rounded text-left border text-[10px] truncate transition-colors"
                style={{
                  backgroundColor: isSelected ? '#18271f' : '#27272a',
                  borderColor: isSelected ? '#10b981' : '#3f3f46',
                  color: isSelected ? '#34d399' : '#a1a1aa',
                }}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameters */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Hysteresis Threshold:</span>
          <span className="text-emerald-400 font-bold">{hysteresisThreshold.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.50"
          max="0.90"
          step="0.05"
          value={hysteresisThreshold}
          onChange={(e) => setHysteresisThreshold(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer h-1 bg-zinc-800 rounded"
        />

        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Prediction Horizon:</span>
          <span className="text-emerald-400 font-bold">{predictionHorizonMs} ms</span>
        </div>
        <input
          type="range"
          min="100"
          max="1000"
          step="50"
          value={predictionHorizonMs}
          onChange={(e) => setPredictionHorizonMs(parseInt(e.target.value, 10))}
          className="w-full accent-emerald-500 cursor-pointer h-1 bg-zinc-800 rounded"
        />
      </div>

      {/* Telemetry Stats */}
      <div className="p-2 mb-3 rounded bg-zinc-900 border border-zinc-800 space-y-1 text-[11px]">
        <div className="flex justify-between text-zinc-400">
          <span>Cache Hit Ratio:</span>
          <span className="text-emerald-400 font-bold">{hitRatio.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Total Evaluations:</span>
          <span className="text-zinc-200">{telemetry.totalRequests}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Evictions:</span>
          <span className="text-amber-400">{telemetry.evictions}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Decision Latency:</span>
          <span className="text-emerald-400 font-mono">
            {lastDecision ? `${lastDecision.latencyUs.toFixed(2)} µs` : '0.00 µs'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-1.5">
        <button
          onClick={() => evaluateCandidate(Math.floor(Math.random() * 20), 0.85)}
          className="flex-1 py-1 px-2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 text-[10px]"
        >
          + Prefetch
        </button>
        <button
          onClick={() => evaluateCandidate(Math.floor(Math.random() * 10), 0.35)}
          className="flex-1 py-1 px-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-[10px]"
        >
          Miss
        </button>
        <button
          onClick={resetRing}
          className="py-1 px-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 text-[10px]"
          title="Reset ring buffer"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
