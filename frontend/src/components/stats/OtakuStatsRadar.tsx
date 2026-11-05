import React, { useMemo } from 'react';

export interface GenreRadarAxis {
  genreId: number;
  genreName: string;
  chaptersRead: number;
  readingSeconds: number;
  score: number; // 0 to 100
}

export interface OtakuStatsRadarProps {
  axes: GenreRadarAxis[];
  size?: number;
  className?: string;
}

/**
 * Pure SVG Parametric Radar Chart.
 * Designed specifically for Intel GMA 4500MHD & zero-CLS environments:
 * - 0 external charting dependencies (0 Chart.js, 0 D3, < 4KB footprint).
 * - 0 CSS blur or backdrop-filters (hardware-accelerated pure vector path).
 * - Concentric polygonal rings for 25%, 50%, 75%, 100% calibration.
 * - CSS `contain: layout paint` for guaranteed zero Cumulative Layout Shift.
 */
export const OtakuStatsRadar: React.FC<OtakuStatsRadarProps> = ({
  axes,
  size = 320,
  className = '',
}) => {
  const center = size / 2;
  const radius = (size / 2) - 40; // 40px margin for labels

  // Fallback default axes if empty
  const activeAxes = useMemo(() => {
    if (axes.length >= 3) return axes;
    const defaults = ['Acción', 'Fantasía', 'Romance', 'Isekai', 'Comedia', 'Sci-Fi'];
    return defaults.map((name, idx) => ({
      genreId: idx + 1,
      genreName: name,
      chaptersRead: 0,
      readingSeconds: 0,
      score: 0,
    }));
  }, [axes]);

  const numAxes = activeAxes.length;

  // Precompute guide ring polygons (25%, 50%, 75%, 100%)
  const guideRings = useMemo(() => {
    const fractions = [0.25, 0.5, 0.75, 1.0];
    return fractions.map((frac) => {
      const r = radius * frac;
      const points = activeAxes.map((_, i) => {
        const theta = (2 * Math.PI * i) / numAxes - Math.PI / 2;
        const x = center + r * Math.cos(theta);
        const y = center + r * Math.sin(theta);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return { fraction: frac, points };
    });
  }, [center, radius, numAxes, activeAxes]);

  // Compute axis lines and label positions
  const axisDetails = useMemo(() => {
    return activeAxes.map((axis, i) => {
      const theta = (2 * Math.PI * i) / numAxes - Math.PI / 2;
      const xEnd = center + radius * Math.cos(theta);
      const yEnd = center + radius * Math.sin(theta);

      // Label offset
      const labelRadius = radius + 22;
      const xLabel = center + labelRadius * Math.cos(theta);
      const yLabel = center + labelRadius * Math.sin(theta);

      // Text anchor alignment based on quadrant
      let textAnchor: 'middle' | 'start' | 'end' = 'middle';
      if (Math.cos(theta) > 0.3) textAnchor = 'start';
      else if (Math.cos(theta) < -0.3) textAnchor = 'end';

      return {
        ...axis,
        xEnd,
        yEnd,
        xLabel,
        yLabel,
        textAnchor,
      };
    });
  }, [activeAxes, center, radius, numAxes]);

  // Compute player polygon path
  const playerPolygonPoints = useMemo(() => {
    return activeAxes.map((axis, i) => {
      const theta = (2 * Math.PI * i) / numAxes - Math.PI / 2;
      const currentRadius = Math.max(0, Math.min(100, axis.score)) / 100 * radius;
      const x = center + currentRadius * Math.cos(theta);
      const y = center + currentRadius * Math.sin(theta);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [activeAxes, center, radius, numAxes]);

  return (
    <div
      data-testid="otaku-stats-radar"
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      style={{
        width: size,
        height: size,
        contain: 'layout paint',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        aria-label="Gráfico Radar de Preferencias de Lectura por Género"
      >
        {/* Concentric Guide Polygons */}
        {guideRings.map((ring, idx) => (
          <polygon
            key={idx}
            points={ring.points}
            fill="none"
            stroke="#27272a"
            strokeWidth="1"
            strokeDasharray={ring.fraction === 1.0 ? 'none' : '3 3'}
          />
        ))}

        {/* Radial Axis Spokes */}
        {axisDetails.map((axis, idx) => (
          <line
            key={idx}
            x1={center}
            y1={center}
            x2={axis.xEnd}
            y2={axis.yEnd}
            stroke="#3f3f46"
            strokeWidth="1"
          />
        ))}

        {/* Player Data Polygon */}
        <polygon
          data-testid="radar-player-polygon"
          points={playerPolygonPoints}
          fill="rgba(6, 182, 212, 0.22)"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Axis Data Points */}
        {activeAxes.map((axis, idx) => {
          const theta = (2 * Math.PI * idx) / numAxes - Math.PI / 2;
          const currentRadius = (Math.max(0, Math.min(100, axis.score)) / 100) * radius;
          const cx = center + currentRadius * Math.cos(theta);
          const cy = center + currentRadius * Math.sin(theta);

          return (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r="3.5"
              fill="#22d3ee"
              stroke="#083344"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Axis Labels */}
        {axisDetails.map((axis, idx) => (
          <text
            key={idx}
            x={axis.xLabel}
            y={axis.yLabel + 4}
            textAnchor={axis.textAnchor}
            className="text-[11px] font-semibold fill-neutral-300 font-mono tracking-tight"
          >
            {axis.genreName}
          </text>
        ))}
      </svg>
    </div>
  );
};
