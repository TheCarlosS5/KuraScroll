import React, { useState, useEffect } from 'react';
import { BookOpen, Flame, Heart } from 'lucide-react';

export interface SeriesCardProps {
  id: string;
  slug: string;
  titlePrimary: string;
  type: string;
  status: string;
  coverImage?: string | null;
  latestChapter?: number | null;
  shelf?: 'reading' | 'completed' | 'plan_to_read' | 'dropped' | 'none' | string;
  isFavorite?: boolean;
  highlightedTitle?: string;
  highlightedSnippet?: string;
  onClick: (slug: string) => void;
  onToggleFavorite?: (slug: string, isFav: boolean) => void;
}

export const SeriesCard: React.FC<SeriesCardProps> = ({
  id,
  slug,
  titlePrimary,
  type,
  status,
  coverImage,
  latestChapter,
  shelf,
  isFavorite = false,
  highlightedTitle,
  highlightedSnippet,
  onClick,
  onToggleFavorite,
}) => {
  const [favState, setFavState] = useState(isFavorite);

  useEffect(() => {
    setFavState(isFavorite);
  }, [isFavorite]);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !favState;
    setFavState(next);
    onToggleFavorite?.(slug, next);
  };

  const typeBadgeColors: Record<string, string> = {
    manhwa: 'bg-indigo-900/80 text-indigo-300 border-indigo-700/60',
    manhua: 'bg-emerald-900/80 text-emerald-300 border-emerald-700/60',
    manga: 'bg-cyan-900/80 text-cyan-300 border-cyan-700/60',
  };

  const badgeColor = typeBadgeColors[type.toLowerCase()] || 'bg-gray-800 text-gray-300 border-gray-700';

  const shelfBadges: Record<string, { label: string; class: string }> = {
    reading: {
      label: 'Leyendo',
      class: 'bg-cyan-950/90 text-cyan-300 border-cyan-600/70 shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    },
    completed: {
      label: 'Completado',
      class: 'bg-emerald-950/90 text-emerald-300 border-emerald-600/70 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    },
    plan_to_read: {
      label: 'Por Leer',
      class: 'bg-violet-950/90 text-violet-300 border-violet-600/70 shadow-[0_0_10px_rgba(139,92,246,0.3)]',
    },
    dropped: {
      label: 'Pausado',
      class: 'bg-amber-950/90 text-amber-300 border-amber-600/70 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    },
  };

  const currentShelfBadge = shelf && shelf !== 'none' ? shelfBadges[shelf] : null;

  return (
    <div
      data-testid={`series-card-${slug}`}
      onClick={() => onClick(slug)}
      className="group relative bg-[#0e1422] rounded-2xl border border-gray-800/80 overflow-hidden cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(0,229,255,0.15)] transition-all duration-300 flex flex-col select-none"
    >
      {/* Cover Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-900">
        {coverImage ? (
          <img
            src={coverImage}
            alt={titlePrimary}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-gray-800 to-gray-950">
            <BookOpen className="w-12 h-12 text-gray-600 mb-2" />
            <span className="text-xs text-gray-400 font-semibold">{titlePrimary}</span>
          </div>
        )}

        {/* Top-Left: Type Badge & Shelf Badge */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor} backdrop-blur-md`}>
            {type}
          </span>
          {currentShelfBadge && (
            <span
              data-testid={`shelf-badge-${slug}`}
              className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md border ${currentShelfBadge.class} backdrop-blur-md animate-fade-in`}
            >
              {currentShelfBadge.label}
            </span>
          )}
        </div>

        {/* Top-Right: Favorite Button */}
        <button
          type="button"
          data-testid={`favorite-btn-${slug}`}
          onClick={handleHeartClick}
          className={`absolute top-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md border transition-all duration-300 cursor-pointer ${
            favState
              ? 'bg-[#dc2626]/20 border-[#dc2626]/70 text-[#dc2626] shadow-[0_0_12px_rgba(220,38,38,0.5)] scale-110'
              : 'bg-black/60 border-gray-700/60 text-gray-400 hover:text-white hover:bg-black/80'
          }`}
          title={favState ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          aria-label={favState ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Heart
            className={`w-4 h-4 transition-all duration-300 ${
              favState ? 'fill-[#dc2626] text-[#dc2626] animate-pulse' : 'text-gray-300 hover:text-white'
            }`}
          />
        </button>

        {/* Bottom Status / Completed Indicator if completed and no active shelf */}
        {status === 'completed' && !currentShelfBadge && (
          <div className="absolute bottom-2.5 right-2.5 z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 backdrop-blur-md">
              Finalizado
            </span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1422] via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity pointer-events-none" />
      </div>

      {/* Info Section */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        {highlightedTitle ? (
          <h3
            className="font-bold text-sm md:text-base text-gray-100 group-hover:text-cyan-400 line-clamp-2 transition-colors"
            dangerouslySetInnerHTML={{ __html: highlightedTitle }}
            data-testid="series-card-highlighted-title"
          />
        ) : (
          <h3 className="font-bold text-sm md:text-base text-gray-100 group-hover:text-cyan-400 line-clamp-2 transition-colors">
            {titlePrimary}
          </h3>
        )}

        {highlightedSnippet && (
          <p
            className="mt-1 text-xs text-gray-400 line-clamp-2 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedSnippet }}
            data-testid="series-card-highlighted-snippet"
          />
        )}

        <div className="mt-2.5 pt-2 border-t border-gray-800/60 flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            {latestChapter ? `Cap. ${latestChapter}` : 'Disponible'}
          </span>
          <span className="text-[11px] text-cyan-400 group-hover:underline font-medium">
            Leer →
          </span>
        </div>
      </div>
    </div>
  );
};

export default SeriesCard;
