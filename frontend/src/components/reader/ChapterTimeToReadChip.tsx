import React from 'react';

export interface ChapterTimeToReadChipProps {
  currentPage: number;
  totalPages: number;
  averageSecondsPerPage: number;
}

export const ChapterTimeToReadChip: React.FC<ChapterTimeToReadChipProps> = ({
  currentPage,
  totalPages,
  averageSecondsPerPage,
}) => {
  const remainingPages = Math.max(0, totalPages - currentPage);
  const remainingSeconds = remainingPages * averageSecondsPerPage;

  const formatRemainingTime = () => {
    if (remainingPages === 0 || currentPage >= totalPages) {
      return 'Completado';
    }
    if (remainingSeconds < 60) {
      return `~${Math.round(remainingSeconds)}s restantes`;
    }
    const minutes = Math.ceil(remainingSeconds / 60);
    return `~${minutes} min restante${minutes > 1 ? 's' : ''}`;
  };

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 border border-gray-800 rounded-full text-xs font-medium text-gray-200 shadow-sm min-w-[130px] justify-center"
      style={{ contain: 'layout paint', transform: 'translateZ(0)' }}
      role="timer"
      aria-label={`Tiempo estimado de lectura: ${formatRemainingTime()}`}
    >
      {/* Clock Icon */}
      <svg
        className="w-3.5 h-3.5 text-cyan-400 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>

      <div className="flex flex-col leading-tight">
        <span className="font-semibold text-gray-100">{formatRemainingTime()}</span>
        <span className="text-[10px] text-gray-400">
          Pág {currentPage} de {totalPages} • ~{Math.round(averageSecondsPerPage)}s/pág
        </span>
      </div>
    </div>
  );
};
