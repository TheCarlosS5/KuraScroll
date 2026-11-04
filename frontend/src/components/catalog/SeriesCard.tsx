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
    manhwa: 'bg-indigo-950/90 text-indigo-300 border-indigo-800/60',
    manhua: 'bg-emerald-950/90 text-emerald-300 border-emerald-800/60',
    manga: 'bg-zinc-800/90 text-zinc-300 border-zinc-700/60',
  };

  const badgeColor = typeBadgeColors[type.toLowerCase()] || 'bg-zinc-800 text-zinc-300 border-zinc-700';

  const shelfBadges: Record<string, { label: string; class: string }> = {
    reading: {
      label: 'Leyendo',
      class: 'bg-cyan-950/90 text-cyan-300 border-cyan-800/70',
    },
    completed: {
      label: 'Completado',
      class: 'bg-emerald-950/90 text-emerald-300 border-emerald-800/70',
    },
    plan_to_read: {
      label: 'Por Leer',
      class: 'bg-violet-950/90 text-violet-300 border-violet-800/70',
    },
    dropped: {
      label: 'Pausado',
      class: 'bg-amber-950/90 text-amber-300 border-amber-800/70',
    },
  };

  const currentShelfBadge = shelf && shelf !== 'none' ? shelfBadges[shelf] : null;

  return (
    <div
      data-testid={`series-card-${slug}`}
      onClick={() => onClick(slug)}
      className="group relative bg-zinc-900/60 rounded-xl border border-zinc-800/80 overflow-hidden cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/90 transition-all duration-200 active:scale-[0.98] flex flex-col select-none shadow-sm"
    >
      {/* Cover Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950">
        {coverImage ? (
          <img
            src={coverImage}
            alt={titlePrimary}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-900">
            <BookOpen className="w-8 h-8 text-zinc-600 mb-1.5" />
            <span className="text-[11px] text-zinc-400 font-medium line-clamp-2">{titlePrimary}</span>
          </div>
        )}

        {/* Top-Left: Type Badge & Shelf Badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeColor} backdrop-blur-md`}>
            {type}
          </span>
          {currentShelfBadge && (
            <span
              data-testid={`shelf-badge-${slug}`}
              className={`text-[10px] font-medium tracking-wide px-1.5 py-0.5 rounded border ${currentShelfBadge.class} backdrop-blur-md`}
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
          className={`absolute top-2 right-2 z-20 p-1.5 rounded-full backdrop-blur-md border transition-colors cursor-pointer ${
            favState
              ? 'bg-rose-950/70 border-rose-800/60 text-rose-400'
              : 'bg-black/50 border-white/10 text-zinc-400 hover:text-white hover:bg-black/70'
          }`}
          title={favState ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          aria-label={favState ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Heart
            className={`w-3.5 h-3.5 transition-colors ${
              favState ? 'fill-rose-500 text-rose-500' : 'text-zinc-300 hover:text-white'
            }`}
          />
        </button>

        {/* Bottom Status / Completed Indicator if completed and no active shelf */}
        {status === 'completed' && !currentShelfBadge && (
          <div className="absolute bottom-2 right-2 z-10">
            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 backdrop-blur-md">
              Finalizado
            </span>
          </div>
        )}

        {/* Subtle Bottom Gradient for text separation */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity pointer-events-none" />
      </div>

      {/* Info Section */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-1.5">
        <div>
          {highlightedTitle ? (
            <h3
              className="font-semibold text-xs sm:text-sm text-zinc-100 group-hover:text-white line-clamp-1 transition-colors"
              dangerouslySetInnerHTML={{ __html: highlightedTitle }}
              data-testid="series-card-highlighted-title"
            />
          ) : (
            <h3 className="font-semibold text-xs sm:text-sm text-zinc-100 group-hover:text-white line-clamp-1 transition-colors">
              {titlePrimary}
            </h3>
          )}

          {highlightedSnippet && (
            <p
              className="mt-1 text-[11px] text-zinc-400 line-clamp-1 leading-snug"
              dangerouslySetInnerHTML={{ __html: highlightedSnippet }}
              data-testid="series-card-highlighted-snippet"
            />
          )}
        </div>

        <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-500/80" />
            {latestChapter ? `Cap. ${latestChapter}` : 'Disponible'}
          </span>
          <span className="text-zinc-400 font-medium capitalize">
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SeriesCard;
