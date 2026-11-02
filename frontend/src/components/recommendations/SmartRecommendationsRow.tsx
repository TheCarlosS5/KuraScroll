import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Clock, Compass } from 'lucide-react';

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
        // Network or offline fallback
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
      const amount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="mb-10 animate-pulse" data-testid="recommendations-loading">
        <div className="h-6 w-56 bg-gray-800 rounded mb-4" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-52 h-72 bg-gray-900 border border-gray-800 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-10" aria-label="Recomendaciones personalizadas" data-testid="recommendations-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              Recomendados para ti
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700/40">
                IA Ligera & Afinidad
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Basado en tus hábitos de lectura y equilibrio de serendipia (Cero ML en disco).
            </p>
          </div>
        </div>

        {/* Carousel Arrow Controls */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Desplazar a la izquierda"
            aria-label="Desplazar a la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Desplazar a la derecha"
            aria-label="Desplazar a la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Shelf (Optimized for Intel GMA 4500MHD: no blurs, pure transform) */}
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') scroll('left');
          if (e.key === 'ArrowRight') scroll('right');
        }}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-gray-800 focus:outline-none"
      >
        {items.map((item) => {
          const isHighAffinity = item.affinityScore >= 80;
          const isMediumAffinity = item.affinityScore >= 50;
          const isSerendipity = item.reasonType === 'serendipity';

          const pillBg = isSerendipity
            ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
            : isHighAffinity
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
            : isMediumAffinity
            ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
            : 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60';

          return (
            <div
              key={item.id}
              onClick={() => onSelectSeries(item.slug)}
              className="group relative w-48 sm:w-56 flex-shrink-0 bg-gray-900/90 border border-gray-800/80 hover:border-indigo-500/80 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1"
              data-testid={`recommendation-card-${item.slug}`}
            >
              {/* Cover Image Container */}
              <div className="relative aspect-[3/4] w-full bg-gray-950 overflow-hidden">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={item.titlePrimary}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gray-950">
                    <Compass className="w-8 h-8 text-gray-700 mb-2" />
                    <span className="text-xs text-gray-500 font-medium line-clamp-2">
                      {item.titlePrimary}
                    </span>
                  </div>
                )}

                {/* Score / Discovery Badge in Top Right */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${pillBg}`}
                  >
                    {isSerendipity ? 'Salto' : item.affinityScore > 0 ? `${item.affinityScore}% match` : 'Popular'}
                  </span>
                </div>

                {/* Format pill (Manga / Manhwa / Manhua) */}
                <div className="absolute bottom-2 left-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-950/90 border border-gray-800 text-gray-300">
                    {item.type}
                  </span>
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-3">
                {/* Otaku Reason Micro-Badge */}
                <p
                  className="text-[11px] font-medium text-indigo-400 line-clamp-1 mb-1"
                  title={item.reasonBadge}
                >
                  {item.reasonBadge}
                </p>

                {/* Title */}
                <h3
                  className="text-sm font-semibold text-gray-100 group-hover:text-indigo-300 line-clamp-1 transition-colors"
                  title={item.titlePrimary}
                >
                  {item.titlePrimary}
                </h3>

                {/* Estimated reading time per chapter */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    ~{item.estimatedChapterMinutes} min / cap
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase">
                    {item.genres[0] || 'Aventura'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
