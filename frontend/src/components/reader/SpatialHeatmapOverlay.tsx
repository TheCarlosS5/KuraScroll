/**
 * KuraScroll Spatial Reading Heatmap Canvas 2D Overlay
 * Sprint 61 - Continuous In-Memory Spatial Reading Heatmap & Kinetic Focus Analyzer
 *
 * Hardware-conscious design for Intel GMA 4500MHD GPU:
 * - Pure solid Canvas 2D rendering (0 CSS blur, 0 backdrop-filter)
 * - 0 CLS: Strict layout containment (`contain: layout paint`)
 * - High-speed bilinearly-stepped 16x16 grid rendering
 */

import React, { useEffect, useRef } from 'react';
import { Eye, EyeOff, Layers, Sliders } from 'lucide-react';

export interface SpatialHeatmapOverlayProps {
  isVisible: boolean;
  opacity: number; // 0.1 to 0.8
  gridData: number[][]; // 16x16 normalized matrix (0.0 to 1.0)
  totalDwellMs?: number;
  peakIntensity?: number;
  onToggleVisibility?: () => void;
  onOpacityChange?: (opacity: number) => void;
  className?: string;
}

export const SpatialHeatmapOverlay: React.FC<SpatialHeatmapOverlayProps> = ({
  isVisible,
  opacity,
  gridData,
  totalDwellMs = 0,
  peakIntensity = 0,
  onToggleVisibility,
  onOpacityChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.max(0.1, Math.min(0.85, opacity));

    const rows = gridData.length;
    const cols = gridData[0]?.length || 0;
    if (rows === 0 || cols === 0) return;

    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = gridData[r][c]; // 0.0 to 1.0
        if (val <= 0.05) continue;

        // Bilinear stepped color ramp (Zero blur / zero gradient CPU pressure)
        let color = 'transparent';
        if (val > 0.8) {
          color = 'rgba(239, 68, 68, 0.75)'; // Coral Red (Peak Focus)
        } else if (val > 0.6) {
          color = 'rgba(234, 179, 8, 0.70)'; // Warm Amber (Active Dialogue)
        } else if (val > 0.3) {
          color = 'rgba(6, 182, 212, 0.60)'; // Cyan (Artwork / Secondary Focus)
        } else {
          color = 'rgba(30, 27, 75, 0.50)'; // Deep Indigo (Periphery Dwell)
        }

        ctx.fillStyle = color;
        // Overlap +1px to prevent sub-pixel seam bleeding on legacy renderers
        ctx.fillRect(
          Math.floor(c * cellWidth),
          Math.floor(r * cellHeight),
          Math.ceil(cellWidth) + 1,
          Math.ceil(cellHeight) + 1
        );
      }
    }
  }, [isVisible, opacity, gridData]);

  if (!isVisible) return null;

  const dwellSec = (totalDwellMs / 1000).toFixed(1);

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-30 overflow-hidden ${className}`}
      style={{ contain: 'layout paint' }}
      aria-hidden="true"
    >
      {/* Canvas 2D Surface */}
      <canvas
        ref={canvasRef}
        width={800}
        height={1200}
        className="w-full h-full object-contain pointer-events-none"
      />

      {/* Hardware-safe Mini HUD Badge (Pointer events enabled on chip only) */}
      <div className="absolute bottom-4 right-4 z-40 pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 select-none shadow-md">
        <Layers className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-semibold text-zinc-300">Spatial Heatmap</span>
        <span className="text-zinc-500">|</span>
        <span className="text-amber-400 font-mono">{dwellSec}s</span>
        <span className="text-zinc-500">|</span>
        <span className="text-zinc-400 font-mono">Peak: {peakIntensity}</span>

        {onOpacityChange && (
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-zinc-700">
            <Sliders className="w-3 h-3 text-zinc-400" />
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={opacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              className="w-16 h-1 bg-zinc-700 rounded appearance-none cursor-pointer accent-cyan-400"
              title="Overlay Opacity"
            />
          </div>
        )}

        {onToggleVisibility && (
          <button
            onClick={onToggleVisibility}
            className="ml-1 p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
            title="Toggle Overlay [H]"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        )}

        <kbd className="px-1 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
          H
        </kbd>
      </div>
    </div>
  );
};
