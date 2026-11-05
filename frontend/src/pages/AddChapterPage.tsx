import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpen, Upload } from 'lucide-react';

export interface AddChapterPageProps {
  seriesId: string;
  seriesTitle: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const AddChapterPage: React.FC<AddChapterPageProps> = ({
  seriesId,
  seriesTitle,
  onBack,
  onSuccess,
}) => {
  const [chapterNumber, setChapterNumber] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [uploadMode, setUploadMode] = useState<'archive' | 'pages'>('archive');
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [pageFiles, setPageFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const number = Number(chapterNumber);
    if (!Number.isFinite(number) || number < 0) {
      setError('Indica un número de capítulo válido.');
      return;
    }
    if (uploadMode === 'archive') {
      if (!archiveFile) {
        setError('Selecciona un archivo comprimido (.cbz o .zip) para el capítulo.');
        return;
      }
      if (archiveFile.size > 250 * 1024 * 1024) {
        setError('El archivo comprimido no debe pesar más de 250 MB.');
        return;
      }
    } else {
      if (pageFiles.length === 0) {
        setError('Selecciona al menos una página para el capítulo.');
        return;
      }
      if (pageFiles.length > 250 || pageFiles.some((file) => file.size > 25 * 1024 * 1024)) {
        setError('Cada capítulo admite hasta 250 páginas y cada archivo debe pesar 25 MB o menos.');
        return;
      }
    }

    setLoading(true);
    setUploadProgress(0);
    let createdChapterId: string | null = null;
    try {
      const chapterResponse = await fetch(`/api/v1/manga/${encodeURIComponent(seriesId)}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'KuraScrollSPA',
        },
        credentials: 'include',
        body: JSON.stringify({
          chapterNumber: number,
          title: chapterTitle.trim() || undefined,
        }),
      });
      const chapterData = await chapterResponse.json();
      if (!chapterResponse.ok) {
        throw new Error(chapterData.message || 'No se pudo crear el capítulo.');
      }
      createdChapterId = String(chapterData.chapter.id);

      if (uploadMode === 'archive') {
        const archiveForm = new FormData();
        archiveForm.append('archive', archiveFile!);
        const archRes = await fetch(
          `/api/v1/manga/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(createdChapterId)}/upload-archive`,
          {
            method: 'POST',
            headers: { 'X-Requested-With': 'KuraScrollSPA' },
            credentials: 'include',
            body: archiveForm,
          }
        );
        const archData = await archRes.json();
        if (!archRes.ok) {
          throw new Error(archData.message || 'Error al procesar el archivo comprimido del capítulo.');
        }
      } else {
        for (let index = 0; index < pageFiles.length; index += 1) {
          const formData = new FormData();
          formData.append('page', pageFiles[index]);
          const pageResponse = await fetch(
            `/api/v1/manga/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(createdChapterId)}/pages`,
            {
              method: 'POST',
              headers: { 'X-Requested-With': 'KuraScrollSPA' },
              credentials: 'include',
              body: formData,
            },
          );
          const pageData = await pageResponse.json();
          if (!pageResponse.ok) {
            throw new Error(`Página ${index + 1}: ${pageData.message || 'no se pudo subir.'}`);
          }
          setUploadProgress(index + 1);
        }
      }

      const publishResponse = await fetch(
        `/api/v1/manga/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(createdChapterId)}/publish`,
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
      const publishData = await publishResponse.json();
      if (!publishResponse.ok) {
        throw new Error(publishData.message || 'No se pudo publicar el capítulo.');
      }

      onSuccess();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Error al procesar el capítulo.';
      if (createdChapterId) {
        try {
          const cleanup = await fetch(
            `/api/v1/manga/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(createdChapterId)}`,
            {
              method: 'DELETE',
              headers: { 'X-Requested-With': 'KuraScrollSPA' },
              credentials: 'include',
            },
          );
          setError(cleanup.ok
            ? `${message} El borrador incompleto se eliminó; puedes volver a intentarlo.`
            : `${message} El capítulo quedó como borrador y puedes volver a intentarlo.`);
        } catch {
          setError(`${message} El capítulo quedó como borrador y puedes volver a intentarlo.`);
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
        type="button"
        onClick={onBack}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a la serie</span>
      </button>

      <div className="bg-[#0e1422] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Subir un capítulo</h1>
            <p className="text-xs text-gray-400">{seriesTitle}</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-300">Modo de subida</span>
            <div className="inline-flex rounded-lg bg-gray-900 p-0.5 border border-gray-700">
              <button
                type="button"
                onClick={() => setUploadMode('archive')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
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
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
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
              <label htmlFor="chapter-number" className="block text-xs font-semibold text-gray-300 mb-1">Número *</label>
              <input
                id="chapter-number"
                type="number"
                value={chapterNumber}
                onChange={(event) => setChapterNumber(event.target.value)}
                min="0"
                step="0.1"
                required
                disabled={loading}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="chapter-title" className="block text-xs font-semibold text-gray-300 mb-1">Título (opcional)</label>
              <input
                id="chapter-title"
                type="text"
                value={chapterTitle}
                onChange={(event) => setChapterTitle(event.target.value)}
                maxLength={200}
                disabled={loading}
                placeholder="Nombre del capítulo"
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100"
              />
            </div>
          </div>

          {uploadMode === 'archive' ? (
            <div>
              <label className="block border border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-cyan-500 transition-colors">
                <Upload className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
                <span className="block text-sm font-semibold text-gray-200">
                  {archiveFile ? archiveFile.name : 'Selecciona archivo .cbz o .zip'}
                </span>
                <span className="block mt-1 text-xs text-gray-500">
                  {archiveFile
                    ? `${(archiveFile.size / (1024 * 1024)).toFixed(1)} MB`
                    : 'Máximo 250 MB. Se extraerán y optimizarán todas las páginas a WebP.'}
                </span>
                <input
                  type="file"
                  accept=".cbz,.zip,application/zip,application/x-zip-compressed"
                  disabled={loading}
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
                  className="sr-only"
                />
              </label>
            </div>
          ) : (
            <div>
              <label className="block border border-dashed border-gray-700 rounded-xl p-5 text-center cursor-pointer hover:border-cyan-500 transition-colors">
                <Upload className="w-5 h-5 mx-auto mb-2 text-cyan-400" />
                <span className="block text-sm font-semibold text-gray-200">Selecciona las páginas del capítulo</span>
                <span className="block mt-1 text-xs text-gray-500">Hasta 250 imágenes, 25 MB por archivo. El orden seleccionado se conserva.</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={loading}
                  onChange={(event) => setPageFiles(Array.from(event.target.files || []))}
                  className="sr-only"
                />
              </label>

              <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                <span>{pageFiles.length ? `${pageFiles.length} página(s) seleccionada(s)` : 'Ninguna página seleccionada'}</span>
                {loading && <span>Subiendo {uploadProgress} / {pageFiles.length}</span>}
              </div>
              {pageFiles.length > 0 && (
                <div className="max-h-28 overflow-y-auto text-[11px] text-gray-500 space-y-0.5 mt-1">
                  {pageFiles.map((file, index) => <div key={`${file.name}-${index}`}>{index + 1}. {file.name}</div>)}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (uploadMode === 'archive' ? !archiveFile : pageFiles.length === 0)}
            className="w-full px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
          >
            {loading
              ? (uploadMode === 'archive' ? 'Subiendo y procesando archivo…' : `Subiendo ${uploadProgress} / ${pageFiles.length}…`)
              : 'Subir y publicar capítulo'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddChapterPage;
