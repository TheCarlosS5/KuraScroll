import React, { useState, useEffect } from 'react';
import { localClientStorage } from '../services/local-storage-service.js';
import { ArrowLeft, BookOpen, Bookmark, CheckCircle2, Clock, Globe } from 'lucide-react';

export interface SeriesDetailPageProps {
  slug: string;
  onBack: () => void;
  onReadChapter: (chapterId: string) => void;
}

export const SeriesDetailPage: React.FC<SeriesDetailPageProps> = ({
  slug,
  onBack,
  onReadChapter,
}) => {
  const [series, setSeries] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [lastReadChapterId, setLastReadChapterId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/series/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setSeries(data);

          // Check local bookmark & progress
          const bookmarks = await localClientStorage.getBookmarks();
          setIsBookmarked(bookmarks.includes(slug));

          const progress = await localClientStorage.getProgress(data.id || slug);
          if (progress) {
            setLastReadChapterId(progress.chapterId);
          }
        }
      } catch (e) {
        console.error('Failed to load series details:', e);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [slug]);

  const handleToggleBookmark = async () => {
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    await localClientStorage.toggleBookmark(slug, nextState);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Cargando serie...</p>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Serie no encontrada.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm"
        >
          Volver al catálogo
        </button>
      </div>
    );
  }

  const chapters = series.chapters || [];
  const firstChapterId = chapters[0]?.id;
  const continueChapterId = lastReadChapterId || firstChapterId;

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a la biblioteca
      </button>

      {/* Series Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 bg-[#0c121e] rounded-3xl border border-gray-800/80 p-6 md:p-8 shadow-2xl">
        {/* Cover Art */}
        <div className="md:col-span-1">
          <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-gray-900 shadow-xl border border-gray-800">
            {series.coverImage ? (
              <img
                src={series.coverImage}
                alt={series.titlePrimary}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <BookOpen className="w-16 h-16 text-gray-600" />
              </div>
            )}
          </div>
        </div>

        {/* Details & Actions */}
        <div className="md:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                {series.type}
              </span>
              <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-md bg-gray-800 text-gray-300">
                {series.status}
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
              {series.titlePrimary}
            </h1>

            {/* Localized Titles Pill Badges */}
            {series.titles && series.titles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Globe className="w-3.5 h-3.5 text-gray-500" />
                {series.titles.map((t: any, idx: number) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300"
                  >
                    <strong className="text-gray-500 uppercase text-[10px] mr-1">
                      {t.languageCode}:
                    </strong>
                    {t.title}
                  </span>
                ))}
              </div>
            )}

            <p className="text-gray-300 text-sm md:text-base leading-relaxed line-clamp-4 mt-2">
              {series.synopsis || 'Sin sinopsis disponible.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-6 pt-6 border-t border-gray-800/80">
            {continueChapterId && (
              <button
                onClick={() => onReadChapter(continueChapterId)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                {lastReadChapterId ? 'Continuar Leyendo' : 'Empezar a Leer'}
              </button>
            )}

            <button
              onClick={handleToggleBookmark}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 ${
                isBookmarked
                  ? 'bg-violet-900/40 border-violet-600 text-violet-300'
                  : 'bg-gray-900 border-gray-800 text-gray-300 hover:text-white'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-violet-400 text-violet-400' : ''}`} />
              {isBookmarked ? 'Guardado en Favoritos' : 'Añadir a Favoritos'}
            </button>
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>Capítulos Disponibles</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-mono">
            {chapters.length}
          </span>
        </h2>

        {chapters.length === 0 ? (
          <div className="p-8 text-center bg-gray-900/40 rounded-2xl border border-gray-800 text-gray-500 text-sm">
            No hay capítulos cargados todavía. Usa el CLI de ingesta para añadir archivos CBZ o imágenes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {chapters.map((c: any) => (
              <div
                key={c.id}
                onClick={() => onReadChapter(c.id)}
                className="p-4 rounded-xl bg-[#0c121e] border border-gray-800/80 hover:border-cyan-500/50 hover:bg-gray-900/80 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-sm text-gray-200 group-hover:text-cyan-400 transition-colors">
                    Capítulo {c.chapterNumber}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {c.title || `${c.pageCount} páginas`}
                  </p>
                </div>
                <span className="text-xs text-gray-400 group-hover:text-cyan-400 font-medium">
                  Leer →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
