import React, { useMemo } from 'react';

export interface DayActivityItem {
  date: string;
  pages: number;
  seconds: number;
  intensity: number; // 0 (none) to 4 (peak)
}

export interface OtakuActivityHeatmapProps {
  days: DayActivityItem[];
  totalDaysActive?: number;
  totalPagesPeriod?: number;
  totalReadingSeconds?: number;
  className?: string;
}

const INTENSITY_COLORS = [
  '#18181b', // 0: neutral-900
  '#083344', // 1: cyan-950
  '#155e75', // 2: cyan-800
  '#0891b2', // 3: cyan-600
  '#22d3ee', // 4: cyan-400
];

const INTENSITY_STROKES = [
  '#27272a', // 0: neutral-800
  '#0e7490', // 1: cyan-700
  '#06b6d4', // 2: cyan-500
  '#22d3ee', // 3: cyan-400
  '#67e8f9', // 4: cyan-300
];

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * Pure SVG GitHub-style Annual Reading Activity Heatmap.
 * Designed for Intel GMA 4500MHD & zero-CLS environments:
 * - 0 external charting dependencies (< 3KB footprint).
 * - Pure SVG `<rect>` grid without DOM reflows or GPU canvas contexts.
 * - Native `<title>` tags for zero-overhead tooltips.
 * - CSS `contain: layout paint` for guaranteed zero CLS.
 */
export const OtakuActivityHeatmap: React.FC<OtakuActivityHeatmapProps> = ({
  days,
  totalDaysActive = 0,
  totalPagesPeriod = 0,
  totalReadingSeconds = 0,
  className = '',
}) => {
  // Group days into 52 columns x 7 rows
  const weeks = useMemo(() => {
    const list = [...days];
    // Ensure we have a multiple of 7 or up to 53 weeks
    const result: DayActivityItem[][] = [];
    for (let i = 0; i < list.length; i += 7) {
      result.push(list.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const totalHours = Math.round((totalReadingSeconds / 3600) * 10) / 10;

  return (
    <div
      data-testid="otaku-activity-heatmap"
      className={`w-full flex flex-col gap-3 ${className}`}
      style={{ contain: 'layout paint' }}
    >
      {/* Header Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-neutral-300 font-mono">
          <span>
            <strong className="text-cyan-400 font-bold">{totalDaysActive}</strong> días activos
          </span>
          <span>
            <strong className="text-cyan-400 font-bold">{totalPagesPeriod}</strong> páginas
          </span>
          <span>
            <strong className="text-cyan-400 font-bold">{totalHours}</strong> hrs lectura
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <span>Menos</span>
          {INTENSITY_COLORS.map((col, idx) => (
            <div
              key={idx}
              className="w-2.5 h-2.5 rounded-[2px]"
              style={{ backgroundColor: col, border: `1px solid ${INTENSITY_STROKES[idx]}` }}
            />
          ))}
          <span>Más</span>
        </div>
      </div>

      {/* SVG Heatmap Grid */}
      <div className="w-full overflow-x-auto pb-1">
        <svg
          viewBox="0 0 720 115"
          className="w-full max-w-full h-auto min-w-[640px]"
          aria-label="Mapa de Calor de Lectura Anual"
        >
          {/* Day of Week Labels */}
          {DAY_LABELS.map((label, rowIdx) => (
            <text
              key={rowIdx}
              x="12"
              y={rowIdx * 13 + 24}
              textAnchor="middle"
              className="text-[9px] font-mono fill-neutral-500 font-semibold"
            >
              {label}
            </text>
          ))}

          {/* Week Columns & Day Rectangles */}
          {weeks.map((week, colIdx) => {
            const x = 28 + colIdx * 13;
            return (
              <g key={colIdx}>
                {week.map((day, rowIdx) => {
                  const y = 15 + rowIdx * 13;
                  const intensity = Math.max(0, Math.min(4, day.intensity));
                  const fillColor = INTENSITY_COLORS[intensity];
                  const strokeColor = INTENSITY_STROKES[intensity];

                  return (
                    <rect
                      key={day.date}
                      data-testid={`heatmap-cell-${day.date}`}
                      x={x}
                      y={y}
                      width="10"
                      height="10"
                      rx="2"
                      ry="2"
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth="0.8"
                      className="cursor-pointer hover:stroke-cyan-300 transition-colors"
                    >
                      <title>{`${day.date}: ${day.pages} páginas (~${Math.round(day.seconds / 60)} min)`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
