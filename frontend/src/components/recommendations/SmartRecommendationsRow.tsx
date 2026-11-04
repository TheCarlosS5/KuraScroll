import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Compass } from 'lucide-react';

export interface RecommendationCardItem {
  id: string;
  slug: string;
  titlePrimary: string;
  type: string;
  coverImage: string | null;
  genres: string[];
  affinityScore: number;
  reasonBadge: string;
  reasonType: 'similarity' | 'genre' | 'author' | 'serendipity' | 'popular';
  estimatedChapterMinutes: number;
}

export interface SmartRecommendationsRowProps {
  onSelectSeries: (slug: string) => void;
  userId?: string;
}

export const SmartRecommendationsRow: React.FC<SmartRecommendationsRowProps> = ({
  onSelectSeries,
  userId = 'local_user',
}) => {
  const [items, setItems] = useState<RecommendationCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchRecommendations = async () => {
      try {
        const res = await fetch(`/api/v1/recommendations/personalized?userId=${encodeURIComponent(userId)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.recommendations) {
            setItems(data.recommendations);
          }
        }
      } catch {
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecommendations();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="mb-8 animate-pulse" data-testid="recommendations-loading">
        <div className="h-5 w-44 bg-zinc-800 rounded mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-44 h-64 bg-zinc-900 border border-zinc-800 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 select-none" aria-label="Recomendaciones personalizadas" data-testid="recommendations-section">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Recomendados para ti
            </h2>
            <p className="text-[11px] text-zinc-400">
              Basado en tus lecturas recientes.
            </p>
          </div>
        </div>

        {/* Carousel Arrow Controls */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Desplazar hacia la izquierda"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Desplazar hacia la derecha"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recommendations Horizontal Carousel */}
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') scroll('left');
          if (e.key === 'ArrowRight') scroll('right');
        }}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-none focus:outline-none"
      >
        {items.map((item) => {
          const isSerendipity = item.reasonType === 'serendipity';

          const pillBg = isSerendipity
            ? 'bg-purple-950/70 text-purple-300 border-purple-800/60'
            : item.affinityScore >= 80
            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
            : 'bg-zinc-800 text-zinc-300 border-zinc-700';

          return (
            <div
              key={item.id}
              onClick={() => onSelectSeries(item.slug)}
              className="group relative w-40 sm:w-48 flex-shrink-0 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.98] shadow-sm flex flex-col"
              data-testid={`recommendation-card-${item.slug}`}
            >
              {/* Cover Image Container */}
              <div className="relative aspect-[2/3] w-full bg-zinc-950 overflow-hidden">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={item.titlePrimary}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-900">
                    <Compass className="w-6 h-6 text-zinc-600 mb-1.5" />
                    <span className="text-[11px] text-zinc-400 font-medium line-clamp-2">
                      {item.titlePrimary}
                    </span>
                  </div>
                )}

                {/* Score / Discovery Badge */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${pillBg}`}
                  >
                    {isSerendipity ? 'Salto' : item.affinityScore > 0 ? `${item.affinityScore}% match` : 'Popular'}
                  </span>
                </div>

                {/* Format pill (Manga / Manhwa / Manhua) */}
                <div className="absolute bottom-2 left-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-zinc-950/90 border border-zinc-800 text-zinc-300">
                    {item.type}
                  </span>
                </div>
              </div>

              {/* Card Meta Footer */}
              <div className="p-2.5 flex flex-col justify-between flex-1 gap-1">
                <h3 className="font-medium text-xs text-zinc-100 group-hover:text-white line-clamp-1 transition-colors">
                  {item.titlePrimary}
                </h3>

                {item.reasonBadge && (
                  <p className="text-[10px] text-zinc-400 line-clamp-1">
                    {item.reasonBadge}
                  </p>
                )}

                {item.estimatedChapterMinutes > 0 && (
                  <span className="text-[10px] text-zinc-400">
                    ~{item.estimatedChapterMinutes} min / cap
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SmartRecommendationsRow;
