import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  localClientStorage,
  LocalReadingProgress,
} from '../services/local-storage-service.js';
import {
  History,
  Clock,
  BookOpen,
  Play,
  Trash2,
  Compass,
  Sparkles,
  Flame,
} from 'lucide-react';

export interface HistoryItem extends LocalReadingProgress {
  title: string;
  slug: string;
  type: string;
  coverImage?: string | null;
  totalChapters?: number | null;
  chapterNumber?: number | null;
  chapterTitle?: string | null;
  progressPercent: number;
}

export interface HistoryPageProps {
  onSelectSeries?: (slug: string) => void;
  onContinueReading?: (chapterId: string, seriesSlug?: string) => void;
  onExploreCatalog?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Reciente';
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

export const HistoryPage: React.FC<HistoryPageProps> = ({
  onSelectSeries,
  onContinueReading,
  onExploreCatalog,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await localClientStorage.getAllProgress();
      // Sort by latest read timestamp descending
      const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);

      // Attempt to enrich with series catalog metadata from backend API
      let catalogMap: Record<string, any> = {};
      try {
        const res = await fetch('/api/v1/series');
        if (res.ok) {
          const data = await res.json();
          (data.items || []).forEach((item: any) => {
            catalogMap[item.id] = item;
            catalogMap[item.slug] = item;
          });
        }
      } catch {
        // Fallback gracefully to offline IndexedDB data if backend is unreachable
      }

      const enriched: HistoryItem[] = sorted.map((record) => {
        const series = catalogMap[record.seriesId] || {};
        const title = series.titlePrimary || series.title || record.seriesId;
        const slug = series.slug || record.seriesId;
        const type = series.type || 'Manga';
        const coverImage = series.coverImage || null;
        const totalChapters = series.totalChapters || null;

        // Extract chapter number from chapterId (e.g., 'c15' -> 15)
        let chNum: number | null = null;
        const numMatch = record.chapterId.match(/\d+/);
        if (numMatch) {
          chNum = parseInt(numMatch[0], 10);
        }

        // Calculate progress percentage
        let progressPercent = 0;
        if (totalChapters && totalChapters > 0 && chNum) {
          progressPercent = Math.min(100, Math.round((chNum / totalChapters) * 100));
        } else if (record.pageNumber > 0) {
          // Estimate page progress if total chapters unknown
          progressPercent = Math.min(100, record.pageNumber * 5);
        }

        return {
          ...record,
          title,
          slug,
          type,
          coverImage,
          totalChapters,
          chapterNumber: chNum,
          progressPercent: progressPercent > 0 ? progressPercent : 15,
        };
      });

      setHistoryItems(enriched);
    } catch (e) {
      console.error('Failed to load reading history from IndexedDB:', e);
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Staggered GSAP animations for history cards and stats
  useEffect(() => {
    if (loading || !containerRef.current) return;

    const ctx = gsap.context(() => {
      if (historyItems.length > 0) {
        gsap.fromTo(
          '.history-header-anim',
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
        );

        gsap.fromTo(
          '.history-card',
          { opacity: 0, y: 25, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.45,
            stagger: 0.07,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      } else {
        gsap.fromTo(
          '.empty-history-anim',
          { opacity: 0, scale: 0.94, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'power3.out' }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [loading, historyItems.length]);

  const handleDeleteItem = async (seriesId: string) => {
    await localClientStorage.deleteProgress(seriesId);
    setHistoryItems((prev) => prev.filter((item) => item.seriesId !== seriesId));
  };

  const handleClearAll = async () => {
    if (window.confirm('¿Deseas vaciar todo tu historial de lectura local?')) {
      await localClientStorage.clearAllProgress();
      setHistoryItems([]);
    }
  };

  const typeBadgeColors: Record<string, string> = {
    manhwa: 'bg-indigo-900/80 text-indigo-300 border-indigo-700/60',
    manhua: 'bg-emerald-900/80 text-emerald-300 border-emerald-700/60',
    manga: 'bg-cyan-900/80 text-cyan-300 border-cyan-700/60',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm font-mono">Cargando historial de lectura...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {/* Header & Stats */}
      {historyItems.length > 0 ? (
        <div className="history-header-anim mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                  <History className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Historial de Lectura
                </h1>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Continúa donde lo dejaste.
              </p>
            </div>

            {/* Quick Actions */}
            <button
              onClick={handleClearAll}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-800/30 rounded-lg transition-colors cursor-pointer"
              title="Vaciar todo el historial"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar Historial</span>
            </button>
          </div>

          {/* Reading Statistics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-[11px] text-zinc-400 font-medium">Series en Lectura</span>
              <p className="text-xl font-bold text-zinc-100 mt-1">
                {historyItems.length}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-[11px] text-zinc-400 font-medium">Última Sesión</span>
              <p className="text-sm font-semibold text-zinc-200 mt-1.5 truncate">
                {historyItems[0] ? formatRelativeTime(historyItems[0].timestamp) : 'N/A'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-zinc-400 font-medium">Sincronización</span>
                <p className="text-xs font-medium text-emerald-400 mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Almacenamiento Local
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* History Grid */}
      {historyItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {historyItems.map((item) => {
            const badgeColor =
              typeBadgeColors[item.type.toLowerCase()] ||
              'bg-zinc-800 text-zinc-300 border-zinc-700';

            return (
              <div
                key={item.seriesId}
                data-testid={`history-card-${item.seriesId}`}
                className="history-card group relative bg-zinc-900/60 rounded-xl border border-zinc-800/80 overflow-hidden hover:border-zinc-700 transition-all duration-200 flex flex-col justify-between active:scale-[0.98]"
              >
                {/* Top: Card Header & Cover */}
                <div>
                  <div
                    onClick={() => onSelectSeries?.(item.slug)}
                    className="relative aspect-[16/9] w-full overflow-hidden bg-gray-900 cursor-pointer"
                  >
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-gray-800 to-gray-950">
                        <BookOpen className="w-8 h-8 text-gray-600 mb-1" />
                        <span className="text-xs text-gray-400 font-semibold line-clamp-1">
                          {item.title}
                        </span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e1422] via-[#0e1422]/40 to-transparent" />

                    {/* Type Badge */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor} backdrop-blur-md`}
                      >
                        {item.type}
                      </span>
                    </div>

                    {/* Delete Item Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.seriesId);
                      }}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-rose-900/80 text-gray-400 hover:text-white transition-colors z-10"
                      title="Eliminar de historial"
                      aria-label="Eliminar del historial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-4">
                    <h2
                      data-testid={`history-title-${item.seriesId}`}
                      onClick={() => onSelectSeries?.(item.slug)}
                      className="font-bold text-base text-gray-100 group-hover:text-cyan-400 line-clamp-1 transition-colors cursor-pointer"
                      title={item.title}
                    >
                      {item.title}
                    </h2>

                    {/* Reading Position Details */}
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                      <span className="font-semibold text-cyan-300">
                        {item.chapterNumber ? `Capítulo ${item.chapterNumber}` : item.chapterId}
                      </span>
                      <span className="font-mono text-[11px] text-gray-400">
                        Pág. {item.pageNumber}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                        <span>Progreso</span>
                        <span className="text-cyan-400 font-bold">{item.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="mt-3.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Action: Continuar Leyendo */}
                <div className="p-4 pt-0">
                  <button
                    data-testid={`continue-btn-${item.seriesId}`}
                    onClick={() => onContinueReading?.(item.chapterId, item.slug)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(0,229,255,0.2)] hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Continuar Leyendo</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div
          data-testid="empty-history-state"
          className="empty-history-anim flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-violet-500/10 border border-white/10 flex items-center justify-center text-cyan-400 mb-6 shadow-[0_0_30px_rgba(0,229,255,0.15)]">
            <History className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-100 mb-2">
            Tu historial de lectura está vacío
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Comienza a explorar el catálogo de Manga, Manhwa y Manhua para registrar tu progreso
            automáticamente sin necesidad de iniciar sesión.
          </p>
          <button
            data-testid="explore-catalog-btn"
            onClick={onExploreCatalog}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all hover:scale-105 cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Explorar Catálogo</span>
          </button>
        </div>
      )}
    </div>
  );
};
