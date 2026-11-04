/**
 * KuraScroll Reading Dwell Attention Heatmap Overlay
 * Sprint 45 - Optical Replay & Kinetic Dwell Heatmaps
 * 
 * Hardware-conscious design for Intel GMA 4500MHD GPU:
 * - Pure solid and linear alpha rendering (0 blur, 0 backdrop-filter)
 * - 0 CLS: Fixed layout overlay decoupled from content reflow
 * - Fast hover tooltips with direct jump-to-page callbacks
 */

import React, { useState } from 'react';
import { Flame, Eye, EyeOff, BarChart2 } from 'lucide-react';

export type AttentionTier = 'breeze' | 'flow' | 'deep' | 'epic';

export interface PageDwellRecord {
  pageNumber: number;
  totalReads: number;
  totalDwellSeconds: number;
  avgDwellSeconds: number;
  intensityScore: number;
  tier: AttentionTier;
}

export interface ChapterAttentionMetrics {
  totalSessionViews: number;
  totalDwellSeconds: number;
  chapterAvgDwellSeconds: number;
  peakAttentionPage: number;
  peakDwellSeconds: number;
}

export interface ReadingDwellHeatmapOverlayProps {
  chapterId: string;
  totalPages: number;
  currentPage: number;
  heatmap: PageDwellRecord[];
  metrics?: ChapterAttentionMetrics;
  onJumpToPage: (pageNumber: number) => void;
  isOpen?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
}

export const TIER_CONFIG: Record<
  AttentionTier,
  { label: string; colorHex: string; bgClass: string; textClass: string; badge: string }
> = {
  epic: {
    label: 'Climax / Peak Attention',
    colorHex: '#F59E0B',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-400',
    badge: 'EPIC'
  },
  deep: {
    label: 'Deep Focus Panel',
    colorHex: '#8B5CF6',
    bgClass: 'bg-violet-500',
    textClass: 'text-violet-400',
    badge: 'DEEP'
  },
  flow: {
    label: 'Steady Flow',
    colorHex: '#06B6D4',
    bgClass: 'bg-cyan-500',
    textClass: 'text-cyan-400',
    badge: 'FLOW'
  },
  breeze: {
    label: 'Brisk Skim',
    colorHex: '#475569',
    bgClass: 'bg-slate-600',
    textClass: 'text-slate-400',
    badge: 'BREEZE'
  }
};

export const ReadingDwellHeatmapOverlay: React.FC<ReadingDwellHeatmapOverlayProps> = ({
  chapterId,
  totalPages,
  currentPage,
  heatmap,
  metrics,
  onJumpToPage,
  isOpen = true,
  onToggleVisibility
}) => {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [hoveredPage, setHoveredPage] = useState<PageDwellRecord | null>(null);

  const toggleVisibility = () => {
    const next = !isVisible;
    setIsVisible(next);
    if (onToggleVisibility) {
      onToggleVisibility(next);
    }
  };

  // Build a lookup map of page stats
  const pageMap = new Map<number, PageDwellRecord>();
  for (const record of heatmap) {
    pageMap.set(record.pageNumber, record);
  }

  const effectiveTotalPages = Math.max(totalPages, heatmap.length, 1);
  const pageSlices = Array.from({ length: effectiveTotalPages }, (_, i) => {
    const pageNum = i + 1;
    return (
      pageMap.get(pageNum) || {
        pageNumber: pageNum,
        totalReads: 0,
        totalDwellSeconds: 0,
        avgDwellSeconds: 0,
        intensityScore: 0,
        tier: 'breeze' as AttentionTier
      }
    );
  });

  return (
    <aside
      data-testid="dwell-heatmap-overlay"
      aria-label="Attention Heatmap Strip"
      className="fixed right-3 top-24 bottom-24 z-40 flex flex-col items-end pointer-events-none select-none font-sans"
    >
      {/* Visibility Toggle Button */}
      <button
        type="button"
        data-testid="dwell-heatmap-toggle"
        onClick={toggleVisibility}
        className="pointer-events-auto mb-2 p-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors shadow-md"
        title={isVisible ? 'Hide Attention Heatmap' : 'Show Attention Heatmap'}
        aria-label={isVisible ? 'Hide Attention Heatmap' : 'Show Attention Heatmap'}
      >
        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      {isVisible && (
        <div className="flex flex-col items-end pointer-events-auto h-full relative">
          {/* Peak Attention Pill */}
          {metrics && metrics.peakAttentionPage > 0 && (
            <div
              data-testid="dwell-peak-pill"
              className="mb-2 px-2.5 py-1 rounded bg-zinc-900 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 shadow-lg whitespace-nowrap"
            >
              <Flame size={14} className="text-amber-400" />
              <span>Peak: P.{metrics.peakAttentionPage} ({metrics.peakDwellSeconds.toFixed(1)}s)</span>
            </div>
          )}

          {/* Hover Detail Card */}
          {hoveredPage && (
            <div
              data-testid="dwell-hover-card"
              className="absolute right-8 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-md p-2.5 text-xs text-zinc-200 shadow-xl w-48 z-50 pointer-events-none"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-white">Page {hoveredPage.pageNumber}</span>
                <span
                  className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${TIER_CONFIG[hoveredPage.tier].textClass} bg-zinc-800 border border-zinc-700`}
                >
                  {TIER_CONFIG[hoveredPage.tier].badge}
                </span>
              </div>
              <div className="text-zinc-400 text-[11px] space-y-0.5">
                <div>Avg Dwell: <strong className="text-zinc-100">{hoveredPage.avgDwellSeconds.toFixed(1)}s</strong></div>
                <div>Intensity: <strong className="text-zinc-100">{hoveredPage.intensityScore.toFixed(0)}%</strong></div>
                <div>Reads Sampled: <strong className="text-zinc-100">{hoveredPage.totalReads}</strong></div>
              </div>
            </div>
          )}

          {/* Vertical Heatmap Scrubber Track */}
          <div
            data-testid="dwell-heatmap-track"
            className="w-3.5 flex-1 bg-zinc-900/90 border border-zinc-700 rounded-full flex flex-col overflow-hidden shadow-lg p-0.5 gap-[1px]"
          >
            {pageSlices.map((slice) => {
              const config = TIER_CONFIG[slice.tier];
              const isCurrent = slice.pageNumber === currentPage;

              return (
                <button
                  key={slice.pageNumber}
                  type="button"
                  data-testid={`dwell-page-slice-${slice.pageNumber}`}
                  onClick={() => onJumpToPage(slice.pageNumber)}
                  onMouseEnter={() => setHoveredPage(slice)}
                  onMouseLeave={() => setHoveredPage(null)}
                  style={{
                    backgroundColor: config.colorHex,
                    opacity: slice.totalReads > 0 ? Math.max(0.35, slice.intensityScore / 100) : 0.2
                  }}
                  className={`flex-1 w-full rounded-sm transition-transform hover:scale-125 focus:outline-none ${
                    isCurrent ? 'ring-2 ring-white z-10' : ''
                  }`}
                  aria-label={`Jump to page ${slice.pageNumber} (${slice.tier} attention)`}
                />
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
