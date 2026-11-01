import React, { useState, useEffect, useRef } from 'react';
import { Play, BookOpen, Clock, ChevronRight } from 'lucide-react';

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
      className="mb-8 select-none"
      aria-label="Continuar Leyendo"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] animate-pulse" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
            Continuar Leyendo
          </h2>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          {formatRelativeTime(primary.updatedAt)}
        </span>
      </div>

      {/* Main Resume Hero Card */}
      <div
        ref={cardRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="group relative rounded-xl bg-gradient-to-r from-[#0f172a] via-[#111827] to-[#0b101b] border border-gray-800/80 hover:border-[#dc2626]/60 p-4 md:p-5 shadow-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#dc2626]/50 flex flex-col md:flex-row items-center gap-4 md:gap-6"
        style={{ contain: 'layout paint' }}
        onClick={() => onContinueReading(primary.chapterId, primary.seriesSlug, primary.pageNumber)}
      >
        {/* Cover / Thumbnail Preview (Strict 0 CLS dimensions) */}
        <div
          className="relative shrink-0 rounded-lg overflow-hidden bg-[#181818] border border-gray-800 shadow-md"
          style={{
            width: '84px',
            height: '126px',
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
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-gray-500 bg-[#141b2d]">
              <BookOpen className="w-6 h-6 mb-1 text-gray-400" />
              <span className="text-[10px] line-clamp-2 leading-tight font-medium text-gray-400">
                {primary.seriesTitle}
              </span>
            </div>
          )}

          {/* Page Bookmark badge */}
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono text-gray-300 border border-gray-700/60 shadow">
            P.{primary.pageNumber}
          </div>
        </div>

        {/* Content Details */}
        <div className="flex-1 min-w-0 w-full text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#dc2626]/20 text-[#f87171] border border-[#dc2626]/30">
              En progreso ({primary.progressPercent}%)
            </span>
            <span className="text-xs text-gray-400 font-mono">
              Capítulo {primary.chapterNumber}
            </span>
          </div>

          <div className="mb-1">
            <h3 className="text-lg md:text-xl font-bold text-white truncate group-hover:text-red-400 transition-colors">
              {primary.titlePreferred || primary.seriesTitle}
            </h3>
            {primary.titleCanonical && primary.titlePreferred && primary.titleCanonical !== primary.titlePreferred && (
              <p className="text-xs text-gray-400 truncate font-normal tracking-wide mt-0.5">
                {primary.titleCanonical}
              </p>
            )}
          </div>

          {primary.chapterTitle ? (
            <p className="text-xs text-gray-400 truncate mt-0.5 mb-3 font-normal">
              {primary.chapterTitle}
            </p>
          ) : (
            <div className="mb-3" />
          )}

          {/* Progress Bar (Strict 0 CLS height) */}
          <div className="w-full bg-gray-800/80 rounded-full h-2 mb-2 overflow-hidden border border-gray-700/50">
            <div
              className="bg-[#dc2626] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(4, primary.progressPercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              Pág. <strong className="text-white font-medium">{primary.pageNumber}</strong> de{' '}
              {primary.totalPages}
            </span>
            <span className="hidden sm:inline text-[11px] text-gray-400">
              Presiona <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300">Space</kbd> o <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300">Enter</kbd>
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 flex items-center justify-center pt-2 md:pt-0 w-full md:w-auto">
          <button
            type="button"
            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#dc2626]/30 hover:shadow-[#dc2626]/50 transition-all active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              onContinueReading(primary.chapterId, primary.seriesSlug, primary.pageNumber);
            }}
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Reanudar Lectura</span>
          </button>
        </div>
      </div>

      {/* Secondary Recent Strip (up to 3 other active reads) */}
      {recentItems.length > 1 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {recentItems.slice(1).map((item) => {
            const isErr = coverErrors[item.seriesId];
            const thumb = !isErr && item.thumbnails?.cover ? item.thumbnails.cover : null;

            return (
              <div
                key={item.seriesId}
                tabIndex={0}
                onClick={() => onContinueReading(item.chapterId, item.seriesSlug, item.pageNumber)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onContinueReading(item.chapterId, item.seriesSlug, item.pageNumber);
                  }
                }}
                className="group flex items-center gap-3 p-2.5 rounded-lg bg-[#0e1422] border border-gray-800/80 hover:border-gray-700 hover:bg-[#131b2e] transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#dc2626]/40"
                style={{ contain: 'layout paint' }}
              >
                <div
                  className="shrink-0 rounded bg-[#181818] overflow-hidden border border-gray-800"
                  style={{ width: '42px', height: '60px', aspectRatio: '2 / 3' }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.seriesTitle}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={() =>
                        setCoverErrors((prev) => ({ ...prev, [item.seriesId]: true }))
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 font-mono">
                      {item.pageNumber}p
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-gray-200 truncate group-hover:text-white">
                    {item.titlePreferred || item.seriesTitle}
                  </h4>
                  {item.titleCanonical && item.titlePreferred && item.titleCanonical !== item.titlePreferred && (
                    <span className="text-[10px] text-gray-400 truncate block">
                      {item.titleCanonical}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                    <span>Cap. {item.chapterNumber}</span>
                    <span>•</span>
                    <span>Pág. {item.pageNumber}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div
                      className="bg-red-500 h-full rounded-full"
                      style={{ width: `${Math.max(5, item.progressPercent)}%` }}
                    />
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
