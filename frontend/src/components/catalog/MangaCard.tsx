import React from 'react';
import { BookOpen, Star, Flame } from 'lucide-react';

export interface MangaCardProps {
  id: string;
  slug: string;
  titlePrimary: string;
  type: string;
  status: string;
  coverImage?: string | null;
  latestChapter?: number | null;
  onClick: (slug: string) => void;
}

export const MangaCard: React.FC<MangaCardProps> = ({
  slug,
  titlePrimary,
  type,
  status,
  coverImage,
  latestChapter,
  onClick,
}) => {
  const typeBadgeColors: Record<string, string> = {
    manhwa: 'bg-indigo-900/80 text-indigo-300 border-indigo-700/60',
    manhua: 'bg-emerald-900/80 text-emerald-300 border-emerald-700/60',
    manga: 'bg-cyan-900/80 text-cyan-300 border-cyan-700/60',
  };

  const badgeColor = typeBadgeColors[type.toLowerCase()] || 'bg-gray-800 text-gray-300 border-gray-700';

  return (
    <div
      onClick={() => onClick(slug)}
      className="group relative bg-[#0e1422] rounded-2xl border border-gray-800/80 overflow-hidden cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(0,229,255,0.15)] transition-all duration-300 flex flex-col"
    >
      {/* Cover Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-900">
        {coverImage ? (
          <img
            src={coverImage}
            alt={titlePrimary}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-gray-800 to-gray-950">
            <BookOpen className="w-12 h-12 text-gray-600 mb-2" />
            <span className="text-xs text-gray-400 font-semibold">{titlePrimary}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor} backdrop-blur-md`}>
            {type}
          </span>
        </div>

        {status === 'completed' && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 backdrop-blur-md">
              Finalizado
            </span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1422] via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
      </div>

      {/* Info Section */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <h3 className="font-bold text-sm md:text-base text-gray-100 group-hover:text-cyan-400 line-clamp-2 transition-colors">
          {titlePrimary}
        </h3>

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
