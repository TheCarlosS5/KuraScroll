import React, { useState, useEffect, useRef } from 'react';
import { Play, BookOpen, Clock } from 'lucide-react';

export interface ResumeItem {
  seriesId: string;
  seriesTitle: string;
  titleCanonical?: string;
  titlePreferred?: string;
  titles?: {
    canonical?: string;
    preferred?: string;
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  seriesSlug: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
  pageNumber: number;
  totalPages: number;
  progressPercent: number;
  isCompleted?: boolean;
  updatedAt?: string;
  resume?: {
    direction?: string;
    scrollOffsetY?: number;
    pageNumber: number;
  };
  thumbnails?: {
    cover: string | null;
    lastRead: string | null;
    coverAvailable?: boolean;
    lastReadAvailable?: boolean;
  };
}

export interface SmartResumePointerProps {
  onContinueReading: (chapterId: string, seriesSlug?: string, pageNumber?: number) => void;
  onSelectSeries?: (seriesSlug: string) => void;
  userId?: string;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Reciente';
  const timestamp = new Date(dateStr).getTime();
  if (isNaN(timestamp)) return 'Reciente';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return new Date(timestamp).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

export const SmartResumePointer: React.FC<SmartResumePointerProps> = ({
  onContinueReading,
  onSelectSeries,
  userId = 'local_user',
}) => {
  const [recentItems, setRecentItems] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverErrors, setCoverErrors] = useState<Record<string, boolean>>({});
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchRecent() {
      try {
        const res = await fetch(`/api/v1/progress/recent?userId=${encodeURIComponent(userId)}&limit=4`);
        if (!res.ok) throw new Error('Failed to fetch recent reading');
        const data = await res.json();
        if (isMounted) {
          setRecentItems(data.items || []);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setRecentItems([]);
          setLoading(false);
        }
      }
    }
    fetchRecent();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading || recentItems.length === 0) {
    return null;
  }

  const primary = recentItems[0];
  const hasCoverError = coverErrors[primary.seriesId];
  const coverSrc = (!hasCoverError && primary.thumbnails?.cover) ? primary.thumbnails.cover : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onContinueReading(primary.chapterId, primary.seriesSlug, primary.pageNumber);
    }
  };

  return (
    <section
      data-testid="smart-resume-pointer"
      className="mb-6 select-none"
      aria-label="Continuar Leyendo"
    >
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Continuar Leyendo
          </h2>
        </div>
        <span className="text-xs text-zinc-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          {formatRelativeTime(primary.updatedAt)}
        </span>
      </div>

      {/* Main Resume Hero Card */}
      <div
        ref={cardRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="group relative rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 p-3.5 md:p-4 shadow-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50 flex flex-col md:flex-row items-center gap-4"
        style={{ contain: 'layout paint' }}
        onClick={() => onContinueReading(primary.chapterId, primary.seriesSlug, primary.pageNumber)}
      >
        {/* Cover / Thumbnail Preview */}
        <div
          className="relative shrink-0 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800"
          style={{
            width: '72px',
            height: '108px',
            aspectRatio: '2 / 3',
            contain: 'layout paint',
          }}
        >
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={primary.seriesTitle}
              loading="lazy"
              decoding="async"
              fetchPriority="high"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => {
                setCoverErrors((prev) => ({ ...prev, [primary.seriesId]: true }));
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-zinc-500 bg-zinc-900">
              <BookOpen className="w-5 h-5 mb-1 text-zinc-500" />
              <span className="text-[10px] line-clamp-2 leading-tight font-medium text-zinc-400">
                {primary.seriesTitle}
              </span>
            </div>
          )}

          {/* Page Bookmark badge */}
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-zinc-300 border border-zinc-700/60 shadow">
            P.{primary.pageNumber}
          </div>
        </div>

        {/* Content Details */}
        <div className="flex-1 min-w-0 w-full text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
              En progreso ({primary.progressPercent}%)
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              Capítulo {primary.chapterNumber}
            </span>
          </div>

          <div className="mb-1">
            <h3 className="text-base md:text-lg font-bold text-zinc-100 truncate group-hover:text-white transition-colors">
              {primary.titlePreferred || primary.seriesTitle}
            </h3>
            {primary.titleCanonical && primary.titlePreferred && primary.titleCanonical !== primary.titlePreferred && (
              <p className="text-xs text-zinc-400 truncate font-normal tracking-wide mt-0.5">
                {primary.titleCanonical}
              </p>
            )}
          </div>

          {primary.chapterTitle ? (
            <p className="text-xs text-zinc-400 truncate mt-0.5 mb-2.5 font-normal">
              {primary.chapterTitle}
            </p>
          ) : (
            <div className="mb-2" />
          )}

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2 overflow-hidden border border-zinc-700/40">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(4, primary.progressPercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              Pág. <strong className="text-zinc-200 font-medium">{primary.pageNumber}</strong> de{' '}
              {primary.totalPages}
            </span>
            <span className="hidden sm:inline text-[11px] text-zinc-400">
              Presiona <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-300">Space</kbd> o <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-300">Enter</kbd>
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 flex items-center justify-center pt-2 md:pt-0 w-full md:w-auto">
          <button
            type="button"
            className="w-full md:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
            onClick={(e) => {
              e.stopPropagation();
              onContinueReading(primary.chapterId, primary.seriesSlug, primary.pageNumber);
            }}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Reanudar Lectura</span>
          </button>
        </div>
      </div>

      {/* Secondary in-progress items strip if more than 1 series in progress */}
      {recentItems.length > 1 && (
        <div className="flex items-center gap-2 mt-2 px-1 overflow-x-auto text-xs text-zinc-400">
          <span className="text-[11px] text-zinc-400 shrink-0">Otras lecturas:</span>
          {recentItems.slice(1).map((item) => (
            <button
              key={item.seriesId}
              onClick={() => onContinueReading(item.chapterId, item.seriesSlug, item.pageNumber)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors truncate max-w-[200px]"
            >
              <span>{item.seriesTitle}</span>
              <span className="text-zinc-500 ml-1.5">Cap. {item.chapterNumber}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default SmartResumePointer;
