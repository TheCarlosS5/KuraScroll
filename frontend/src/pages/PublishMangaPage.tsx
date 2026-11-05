import React, { useState, useRef } from 'react';
import { PlusCircle, ArrowLeft, AlertCircle, BookOpen, Upload, Loader2 } from 'lucide-react';
import { processAndUploadChapterPages } from '../services/chapter-processor-client.js';

export interface PublishMangaPageProps {
  onBack: () => void;
  onSuccess: (slug: string) => void;
}

export const PublishMangaPage: React.FC<PublishMangaPageProps> = ({
  onBack,
  onSuccess,
}) => {
  const [titlePrimary, setTitlePrimary] = useState('');
  const [type, setType] = useState<'manga' | 'manhwa' | 'manhua' | 'comic'>('manga');
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'hiatus' | 'cancelled'>('ongoing');
  const [demographic, setDemographic] = useState<'shounen' | 'seinen' | 'shoujo' | 'josei' | 'none'>('shounen');
  const [synopsis, setSynopsis] = useState('');
  const [author, setAuthor] = useState('');
  const [artist, setArtist] = useState('');
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());
  const [genreInput, setGenreInput] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'archive' | 'pages'>('archive');
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [chapterNumber, setChapterNumber] = useState('1');
  const [chapterTitle, setChapterTitle] = useState('');
  const [pageFiles, setPageFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!titlePrimary.trim()) {
      setError('El título principal es obligatorio.');
      return;
    }

    if (coverFile) {
      if (coverFile.size > 10 * 1024 * 1024) {
        setError('La imagen de portada no debe pesar más de 10 MB.');
        return;
      }
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(coverFile.type)) {
        setError('Formato de portada no compatible. Utilice JPG, PNG o WebP.');
        return;
      }
    }
    if (uploadMode === 'archive') {
      if (!archiveFile) {
        setError('Selecciona un archivo comprimido (.cbz o .zip) para el primer capítulo.');
        return;
      }
      if (archiveFile.size > 250 * 1024 * 1024) {
        setError('El archivo comprimido no debe pesar más de 250 MB.');
        return;
      }
    } else {
      if (pageFiles.length === 0) {
        setError('Selecciona al menos una página para publicar el primer capítulo.');
        return;
      }
      if (pageFiles.length > 250 || pageFiles.some((file) => file.size > 25 * 1024 * 1024)) {
        setError('Cada capítulo admite hasta 250 páginas y cada archivo debe pesar 25 MB o menos.');
        return;
      }
    }

    const genres = genreInput
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    setLoading(true);
    setUploadProgress(0);
    let createdSeriesId: string | null = null;
    try {
      const res = await fetch('/api/v1/manga', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'KuraScrollSPA',
        },
        credentials: 'include',
        body: JSON.stringify({
          titlePrimary: titlePrimary.trim(),
          type,
          status,
          demographic,
          synopsis: synopsis.trim() || undefined,
          author: author.trim() || undefined,
          artist: artist.trim() || undefined,
          releaseYear: Number(releaseYear) || undefined,
          genres,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al publicar la serie');
      }

      const seriesId = String(data.series.id);
      createdSeriesId = seriesId;

      // Upload cover image if provided
      if (coverFile) {
        const coverForm = new FormData();
        coverForm.append('cover', coverFile);
        const coverRes = await fetch(`/api/v1/manga/${encodeURIComponent(seriesId)}/cover`, {
          method: 'POST',
          headers: { 'X-Requested-With': 'KuraScrollSPA' },
          credentials: 'include',
          body: coverForm,
        });
        const coverData = await coverRes.json().catch(() => ({}));
        if (!coverRes.ok) {
          throw new Error(coverData.message || 'Error al subir la imagen de portada de la serie.');
        }
      }

      const chapterResponse = await fetch(`/api/v1/manga/${encodeURIComponent(seriesId)}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'KuraScrollSPA',
        },
        credentials: 'include',
        body: JSON.stringify({
          chapterNumber: Number(chapterNumber),
          title: chapterTitle.trim() || undefined,
        }),
      });
      const chapterData = await chapterResponse.json();
      if (!chapterResponse.ok) {
        throw new Error(chapterData.message || 'No se pudo crear el primer capítulo.');
      }

      // Ingest pages using client WebP processing (Canvas/Worker)
      setProcessingStatus('Iniciando optimización WebP en el navegador...');
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      await processAndUploadChapterPages({
        seriesId,
        chapterId: String(chapterData.chapter.id),
        source: uploadMode === 'archive'
          ? { type: 'archive', file: archiveFile! }
          : { type: 'pages', files: pageFiles },
        options: {
          signal: abortController.signal,
          onProgress: (p) => {
            setUploadProgress(p.percent);
            setProcessingStatus(p.message);
          },
        },
      });

      const chapterPublishResponse = await fetch(
        `/api/v1/manga/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(chapterData.chapter.id)}/publish`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'KuraScrollSPA',
          },
          credentials: 'include',
          body: JSON.stringify({}),
        },
      );
      const chapterPublishData = await chapterPublishResponse.json();
      if (!chapterPublishResponse.ok) {
        throw new Error(chapterPublishData.message || 'No se pudo publicar el primer capítulo.');
      }

      const publishResponse = await fetch(`/api/v1/manga/${encodeURIComponent(seriesId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'KuraScrollSPA',
        },
        credentials: 'include',
        body: JSON.stringify({ visibility: 'published' }),
      });
      const publishData = await publishResponse.json();
      if (!publishResponse.ok) {
        throw new Error(publishData.message || 'No se pudo publicar la serie.');
      }

      onSuccess(data.series.slug);
    } catch (err: any) {
      const message = err.message || 'Error al procesar la publicación.';
      if (createdSeriesId) {
        try {
          const cleanup = await fetch(`/api/v1/manga/${encodeURIComponent(createdSeriesId)}`, {
            method: 'DELETE',
            headers: { 'X-Requested-With': 'KuraScrollSPA' },
            credentials: 'include',
          });
          setError(cleanup.ok
            ? `${message} La serie incompleta se retiró del catálogo; puedes volver a intentarlo.`
            : `${message} La serie ya existe; vuelve a intentarlo desde tu perfil.`);
        } catch {
          setError(`${message} La serie ya existe; vuelve a intentarlo desde tu perfil.`);
        }
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver</span>
      </button>

      <div className="bg-[#0e1422] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Publicar Nueva Serie</h1>
            <p className="text-xs text-gray-400">Agrega un manga, manhwa o cómic al catálogo público de KuraScroll.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Título Principal *
            </label>
            <input
              type="text"
              value={titlePrimary}
              onChange={(e) => setTitlePrimary(e.target.value)}
              placeholder="ej. Solo Leveling o Chainsaw Man"
              required
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-cyan-500 capitalize"
              >
                <option value="manga">Manga</option>
                <option value="manhwa">Manhwa</option>
                <option value="manhua">Manhua</option>
                <option value="comic">Cómic</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-cyan-500 capitalize"
              >
                <option value="ongoing">En emisión</option>
                <option value="completed">Finalizado</option>
                <option value="hiatus">En pausa</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Demografía</label>
              <select
                value={demographic}
                onChange={(e) => setDemographic(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-cyan-500 capitalize"
              >
                <option value="shounen">Shounen</option>
                <option value="seinen">Seinen</option>
                <option value="shoujo">Shoujo</option>
                <option value="josei">Josei</option>
                <option value="none">Ninguna</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Sinopsis</label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={4}
              placeholder="Escribe un resumen atractivo de la trama..."
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Autor</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Nombre del guionista"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Artista</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Nombre del ilustrador"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Año de Estreno</label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) => setReleaseYear(Number(e.target.value))}
                min={1950}
                max={2030}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Géneros (separados por coma)
            </label>
            <input
              type="text"
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
              placeholder="Acción, Aventura, Fantasía, Sobrenatural"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Imagen de Portada (Opcional)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && file.size > 10 * 1024 * 1024) {
                  setError('La portada debe pesar menos de 10 MB.');
                  setCoverFile(null);
                } else {
                  setCoverFile(file);
                }
              }}
              className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-gray-100 hover:file:bg-gray-700"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              JPG, PNG o WebP · máximo 10 MB. Se optimizará automáticamente.
            </p>
          </div>

          <div className="border-t border-gray-800 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-100">Primer capítulo</h2>
                <p className="text-xs text-gray-500 mt-0.5">Sube un archivo .cbz / .zip o imágenes individuales.</p>
              </div>
              <div className="inline-flex rounded-lg bg-gray-900 p-0.5 border border-gray-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setUploadMode('archive')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    uploadMode === 'archive'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Archivo (.cbz o .zip)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('pages')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    uploadMode === 'pages'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Imágenes sueltas
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Número</label>
                <input
                  type="number"
                  value={chapterNumber}
                  onChange={(event) => setChapterNumber(event.target.value)}
                  min="0"
                  step="0.1"
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-300 mb-1">Título del capítulo (opcional)</label>
                <input
                  type="text"
                  value={chapterTitle}
                  onChange={(event) => setChapterTitle(event.target.value)}
                  maxLength={160}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100"
                />
              </div>
            </div>

            {uploadMode === 'archive' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Archivo del capítulo (.cbz o .zip) *</label>
                <input
                  type="file"
                  accept=".cbz,.zip,application/zip,application/x-zip-compressed"
                  required
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    if (file && file.size > 250 * 1024 * 1024) {
                      setError('El archivo comprimido supera el límite de 250 MB.');
                      setArchiveFile(null);
                    } else {
                      setArchiveFile(file);
                      setError(null);
                    }
                  }}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-gray-100 hover:file:bg-gray-700"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Formatos soportados: CBZ o ZIP con imágenes · máximo 250 MB. Las páginas se ordenan naturalmente.
                </p>
                {archiveFile && (
                  <p className="text-xs text-cyan-300 mt-2 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {archiveFile.name} ({(archiveFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Páginas del capítulo *</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  required
                  aria-describedby="page-upload-help"
                  onChange={(event) => {
                    const selected = Array.from(event.target.files || []);
                    setPageFiles(selected);
                    if (selected.length > 250 || selected.some((file) => file.size > 25 * 1024 * 1024)) {
                      setError('Cada capítulo admite hasta 250 páginas y cada archivo debe pesar 25 MB o menos.');
                    } else {
                      setError(null);
                    }
                  }}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-gray-100 hover:file:bg-gray-700"
                />
                <p id="page-upload-help" className="text-[11px] text-gray-500 mt-1">
                  JPEG, PNG, WebP o GIF · máximo 25 MB por página y 250 páginas por capítulo.
                </p>
                {pageFiles.length > 0 && (
                  <p className="text-xs text-cyan-300 mt-2 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {loading ? `Subiendo ${uploadProgress} de ${pageFiles.length} páginas…` : `${pageFiles.length} páginas listas`}
                  </p>
                )}
              </div>
            )}
          </div>

          {loading && (
            <div className="p-4 rounded-xl bg-gray-900 border border-cyan-800/60 shadow-inner space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  {processingStatus || 'Procesando en cliente...'}
                </span>
                <span className="font-mono text-cyan-400 font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 hover:underline"
                >
                  Cancelar proceso
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-colors mt-6 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Procesando y subiendo páginas…</span>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                <span>Publicar en la biblioteca</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
