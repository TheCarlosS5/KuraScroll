import React from 'react';

export interface DailyGoalRingProps {
  current: number;
  target: number;
  unit?: string;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Sprint 30: DailyGoalRing
 * Lightweight circular progress ring engineered for legacy Intel GMA 4500MHD GPU.
 * ZERO SVG blur/drop-shadow filters, pure CSS transitions, strict layout containment.
 */
export const DailyGoalRing: React.FC<DailyGoalRingProps> = React.memo(function DailyGoalRing({
  current,
  target,
  unit = 'pág',
  size = 36,
  strokeWidth = 3.5,
  showText = false,
  onClick,
  className = '',
}) {
  const safeTarget = Math.max(1, target);
  const clampedCurrent = Math.max(0, current);
  const percentage = Math.min(100, Math.round((clampedCurrent / safeTarget) * 100));
  const isCompleted = clampedCurrent >= safeTarget;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-label="Meta diaria de lectura"
      aria-valuenow={clampedCurrent}
      aria-valuemin={0}
      aria-valuemax={safeTarget}
      aria-valuetext={`${clampedCurrent} de ${safeTarget} ${unit}`}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        contain: 'layout paint',
      }}
      className={`daily-goal-ring ${className}`}
      title={`Meta diaria: ${clampedCurrent}/${safeTarget} ${unit} (${percentage}%)`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: 'rotate(-90deg)',
          display: 'block',
        }}
      >
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isCompleted ? '#10B981' : '#F59E0B'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease',
          }}
        />
      </svg>

      {/* Center Icon or Text */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {showText ? (
          <span style={{ fontSize: size * 0.22, fontWeight: 700, color: isCompleted ? '#10B981' : '#FFFFFF' }}>
            {percentage}%
          </span>
        ) : (
          <span
            style={{
              fontSize: size * 0.42,
              lineHeight: 1,
              transition: 'transform 0.3s ease',
              transform: isCompleted ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {isCompleted ? <span data-testid="goal-star">100%</span> : <span data-testid="goal-target">GOAL</span>}
          </span>
        )}
      </div>
    </div>
  );
});
