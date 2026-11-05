import React, { useState, useEffect, useRef } from 'react';
import { localClientStorage, SeriesShelfType } from '../services/local-storage-service.js';
import { ArrowLeft, BookOpen, Heart, Library, CheckCircle2, Clock, Globe, Download, Flag, Camera } from 'lucide-react';
import { CommentSection } from '../components/comments/CommentSection.js';
import { ReportModal } from '../components/moderation/ReportModal.js';
import { SafeUser } from '../services/auth-service.js';

export interface SeriesDetailPageProps {
  slug: string;
  currentUser?: SafeUser | null;
  onBack: () => void;
  onReadChapter: (chapterId: string) => void;
  onAddChapter?: (seriesId: string, title: string) => void;
  onRequireAuth?: () => void;
}

export const SeriesDetailPage: React.FC<SeriesDetailPageProps> = ({
  slug,
  currentUser,
  onBack,
  onReadChapter,
  onAddChapter,
  onRequireAuth,
}) => {
  const [series, setSeries] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [shelf, setShelf] = useState<SeriesShelfType>('none');
  const [isFavorite, setIsFavorite] = useState(false);
  const [lastReadChapterId, setLastReadChapterId] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/series/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setSeries(data);

          // Check local bookshelf & favorite status
          const shelfData = await localClientStorage.getSeriesShelf(slug);
          if (shelfData) {
            setShelf((shelfData.shelf as SeriesShelfType) || 'none');
            setIsFavorite(shelfData.favorite);
          } else {
            // Backward compatibility fallback to bookmarks
            const bookmarks = await localClientStorage.getBookmarks();
            if (bookmarks.includes(slug)) {
              setIsFavorite(true);
            }
          }

          let progress = null;
          if (currentUser) {
            const progressResponse = await fetch(`/api/v1/progress/${encodeURIComponent(data.id || slug)}`, {
              credentials: 'include',
              headers: { 'X-Requested-With': 'KuraScrollSPA' },
            });
            if (progressResponse.ok) progress = await progressResponse.json();
          } else {
            progress = await localClientStorage.getProgress(data.id || slug);
          }
          if (progress) {
            setLastReadChapterId(progress.chapterId || null);
          } else {
            setLastReadChapterId(null);
          }
        }
      } catch (e) {
        console.error('Failed to load series details:', e);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [slug, currentUser?.id]);

  const handleShelfChange = async (newShelf: SeriesShelfType) => {
    setShelf(newShelf);
    await localClientStorage.setSeriesShelf(slug, newShelf, isFavorite);
  };

  const handleToggleFavorite = async () => {
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
    await localClientStorage.setSeriesShelf(slug, shelf, nextFav);
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
  const canManageSeries = Boolean(currentUser && (
    currentUser.id === series.uploaderUserId || currentUser.role === 'admin' || currentUser.role === 'moderator'
  ));

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen de portada debe pesar menos de 10 MB.');
      return;
    }
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      alert('Formato de portada no compatible. Utilice JPG, PNG o WebP.');
      return;
    }

    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const res = await fetch(`/api/v1/manga/${encodeURIComponent(series.id)}/cover`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'KuraScrollSPA' },
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Error al actualizar portada (${res.status})`);
      }
      setSeries((prev: any) => ({
        ...prev,
        coverImage: data.coverUrl,
      }));
    } catch (err: any) {
      alert(err.message || 'Error al actualizar portada');
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const shelfLabels: Record<SeriesShelfType, string> = {
    none: 'Añadir a Biblioteca...',
    reading: 'Leyendo',
    plan_to_read: 'Por Leer',
    completed: 'Completado',
    dropped: 'Pausado',
  };

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 p-6 md:p-8 shadow-sm">
        {/* Cover Art */}
        <div className="md:col-span-1">
          <div className="group relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-950 shadow-md border border-zinc-800">
            {series.coverImage ? (
              <img
                src={series.coverImage}
                alt={series.titlePrimary}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <BookOpen className="w-12 h-12 text-zinc-600" />
              </div>
            )}

            {canManageSeries && (
              <>
                <input
                  type="file"
                  ref={coverInputRef}
                  onChange={handleCoverUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-xs font-semibold cursor-pointer"
                >
                  <Camera className="w-6 h-6 mb-1 text-cyan-300" />
                  <span>{coverUploading ? 'Subiendo...' : 'Cambiar portada'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Details & Actions */}
        <div className="md:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700/60">
                {series.type}
              </span>
              <span className="text-[11px] font-medium uppercase px-2 py-0.5 rounded bg-zinc-800/60 text-zinc-400">
                {series.status}
              </span>
              {shelf !== 'none' && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                  {shelfLabels[shelf]}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2.5">
              {series.titlePrimary}
            </h1>

            {/* Localized Titles Pill Badges */}
            {series.titles && series.titles.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
                {series.titles.map((t: any, idx: number) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400"
                  >
                    <strong className="text-zinc-500 uppercase text-[10px] mr-1">
                      {t.languageCode}:
                    </strong>
                    {t.title}
                  </span>
                ))}
              </div>
            )}

            <p className="text-zinc-300 text-sm leading-relaxed line-clamp-4 mt-2">
              {series.synopsis || 'Sin sinopsis disponible.'}
            </p>
          </div>

          {/* Action Buttons: Read, Shelf Selector & Favorite */}
          <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-zinc-800/60">
            {canManageSeries && onAddChapter && (
              <button
                type="button"
                onClick={() => onAddChapter(series.id, series.titlePrimary)}
                className="px-4 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-semibold text-sm transition-colors"
              >
                Subir capítulo
              </button>
            )}
            <button
              type="button"
              onClick={() => currentUser ? setIsReportOpen(true) : onRequireAuth?.()}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-amber-300 hover:border-amber-700 text-xs font-semibold transition-colors"
            >
              <Flag className="w-3.5 h-3.5" /> Reportar manga
            </button>
            {continueChapterId && (
              <button
                onClick={() => onReadChapter(continueChapterId)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-sm transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                {lastReadChapterId ? 'Continuar Leyendo' : 'Empezar a Leer'}
              </button>
            )}

            {/* Bookshelf Selector Dropdown */}
            <div className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1 hover:border-zinc-700 transition-colors">
              <Library className="w-4 h-4 text-zinc-400 mr-2 shrink-0 pointer-events-none" />
              <select
                data-testid="shelf-select"
                value={shelf}
                onChange={(e) => handleShelfChange(e.target.value as SeriesShelfType)}
                aria-label="Seleccionar estado en biblioteca"
                className="bg-transparent text-xs sm:text-sm font-medium text-zinc-200 outline-none cursor-pointer pr-2 py-1"
              >
                <option value="none" className="bg-gray-900 text-gray-400">
                  Quitar de Biblioteca
                </option>
                <option value="reading" className="bg-gray-900 text-cyan-300 font-medium">
                  Leyendo
                </option>
                <option value="plan_to_read" className="bg-gray-900 text-violet-300 font-medium">
                  Por Leer
                </option>
                <option value="completed" className="bg-gray-900 text-emerald-300 font-medium">
                  Completado
                </option>
                <option value="dropped" className="bg-gray-900 text-amber-300 font-medium">
                  Pausado
                </option>
              </select>
            </div>

            {/* Favorite Toggle Button */}
            <button
              data-testid="favorite-toggle-btn"
              onClick={handleToggleFavorite}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                isFavorite
                  ? 'bg-[#dc2626]/20 border-[#dc2626]/70 text-[#dc2626] shadow-[0_0_15px_rgba(220,38,38,0.3)]'
                  : 'bg-gray-900 border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
              title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Heart
                className={`w-4 h-4 transition-transform duration-200 ${
                  isFavorite ? 'fill-[#dc2626] text-[#dc2626] scale-110' : 'text-gray-400'
                }`}
              />
              <span>{isFavorite ? 'En Favoritos' : 'Añadir a Favoritos'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>Capítulos Disponibles</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
            {chapters.length}
          </span>
        </h2>

        {chapters.length === 0 ? (
          <div className="p-8 text-center bg-gray-900/40 rounded-2xl border border-gray-800 text-gray-400 text-sm">
            No hay capítulos cargados para esta serie todavía.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {chapters.map((ch: any) => {
              const isCurrent = lastReadChapterId === ch.id;

              return (
                <div
                  key={ch.id}
                  onClick={() => onReadChapter(ch.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                    isCurrent
                      ? 'bg-cyan-950/40 border-cyan-500/50 hover:bg-cyan-950/60'
                      : 'bg-[#0e1422] border-gray-800/80 hover:border-gray-700 hover:bg-[#131b2e]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-200">
                        Capítulo {ch.chapterNumber}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-400 border border-cyan-700/50">
                          Último leído
                        </span>
                      )}
                    </div>
                    {ch.title && (
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{ch.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/v1/chapters/${ch.id}/export/cbz`}
                      download
                      title="Descargar capítulo en CBZ (ComicBook ZIP)"
                      aria-label={`Descargar capítulo ${ch.chapterNumber} en CBZ`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-gray-800 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <div className="text-xs text-cyan-400 font-medium">Leer →</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Community Comments Section */}
        {series && (
          <CommentSection
            targetType="series"
            targetId={series.id}
            currentUser={currentUser || null}
            onRequireAuth={onRequireAuth || (() => {})}
          />
        )}
        {series && isReportOpen && (
          <ReportModal
            isOpen={isReportOpen}
            onClose={() => setIsReportOpen(false)}
            targetType="series"
            targetId={series.id}
          />
        )}
      </div>
    </div>
  );
};
