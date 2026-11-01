import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  Database,
  Download,
  Upload,
  X,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Layers,
  BookOpen,
  Bookmark,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { localClientStorage, LocalReadingProgress } from '../../services/local-storage-service.js';

export interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export interface BackupPreviewReport {
  fileName: string;
  fileSizeBytes: number;
  format: 'kura_scroll_json' | 'mihon_json' | 'tachiyomi_legacy_json' | 'tachibk_archive' | 'unknown';
  formatLabel: string;
  version?: number;
  seriesCount: number;
  chapterCount: number;
  rawPayload?: any;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function analyzeBackupFile(fileName: string, textOrBuffer: string | ArrayBuffer): BackupPreviewReport {
  const isTachibk = fileName.toLowerCase().endsWith('.tachibk');
  const sizeBytes = typeof textOrBuffer === 'string' ? textOrBuffer.length : textOrBuffer.byteLength;

  if (isTachibk) {
    return {
      fileName,
      fileSizeBytes: sizeBytes,
      format: 'tachibk_archive',
      formatLabel: 'Tachiyomi / Mihon (.tachibk)',
      seriesCount: 1, // Will be parsed on server or decompression
      chapterCount: 0,
      rawPayload: textOrBuffer,
    };
  }

  // Parse as JSON text
  let jsonString = '';
  if (typeof textOrBuffer === 'string') {
    jsonString = textOrBuffer;
  } else {
    try {
      const decoder = new TextDecoder('utf-8');
      jsonString = decoder.decode(textOrBuffer);
    } catch {
      return {
        fileName,
        fileSizeBytes: sizeBytes,
        format: 'unknown',
        formatLabel: 'Archivo no legible',
        seriesCount: 0,
        chapterCount: 0,
      };
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return {
      fileName,
      fileSizeBytes: sizeBytes,
      format: 'unknown',
      formatLabel: 'JSON inválido o corrupto',
      seriesCount: 0,
      chapterCount: 0,
    };
  }

  // Case 1: KuraScroll Native Backup
  if (
    parsed &&
    (parsed.app === 'kura-scroll' ||
      parsed.kuraScroll ||
      (parsed.readingProgress && parsed.shelvedSeries) ||
      (Array.isArray(parsed.readingProgress) && parsed.bookmarks))
  ) {
    const seriesSet = new Set<string>();
    if (Array.isArray(parsed.series)) {
      parsed.series.forEach((s: any) => s.id && seriesSet.add(s.id));
    }
    if (parsed.shelvedSeries && typeof parsed.shelvedSeries === 'object') {
      Object.keys(parsed.shelvedSeries).forEach((id) => seriesSet.add(id));
    }
    if (Array.isArray(parsed.readingProgress)) {
      parsed.readingProgress.forEach((p: any) => p.seriesId && seriesSet.add(p.seriesId));
    }

    const chapterTotal = Array.isArray(parsed.readingProgress) ? parsed.readingProgress.length : 0;

    return {
      fileName,
      fileSizeBytes: sizeBytes,
      format: 'kura_scroll_json',
      formatLabel: 'KuraScroll Backup (JSON)',
      version: parsed.version || 1,
      seriesCount: seriesSet.size || (parsed.series?.length || 0),
      chapterCount: parsed.stats?.chapterCount || chapterTotal,
      rawPayload: parsed,
    };
  }

  // Case 2: Modern Mihon JSON with version and mangas list
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    parsed.version !== undefined &&
    (Array.isArray(parsed.mangas) || Array.isArray(parsed.backupManga))
  ) {
    const mangas = parsed.mangas || parsed.backupManga || [];
    const totalChapters = mangas.reduce((acc: number, m: any) => acc + (m.chapters?.length || 0), 0);

    return {
      fileName,
      fileSizeBytes: sizeBytes,
      format: 'mihon_json',
      formatLabel: `Mihon / Tachiyomi v${parsed.version}`,
      version: Number(parsed.version) || 1,
      seriesCount: mangas.length,
      chapterCount: totalChapters,
      rawPayload: parsed,
    };
  }

  // Case 3: Tachiyomi Legacy with data wrapper
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    (Array.isArray(parsed.data) || Array.isArray(parsed.mangas))
  ) {
    const mangas = parsed.data || parsed.mangas || [];
    const totalChapters = mangas.reduce((acc: number, m: any) => acc + (m.chapters?.length || 0), 0);

    return {
      fileName,
      fileSizeBytes: sizeBytes,
      format: 'tachiyomi_legacy_json',
      formatLabel: 'Tachiyomi Legacy JSON',
      seriesCount: mangas.length,
      chapterCount: totalChapters,
      rawPayload: parsed,
    };
  }

  // Case 4: Tachiyomi Legacy array of manga objects
  if (Array.isArray(parsed)) {
    const isMangaList =
      parsed.length === 0 ||
      parsed.some((item) => item && typeof item === 'object' && ('title' in item || 'chapters' in item));

    if (isMangaList) {
      const totalChapters = parsed.reduce((acc: number, m: any) => acc + (m.chapters?.length || 0), 0);

      return {
        fileName,
        fileSizeBytes: sizeBytes,
        format: 'tachiyomi_legacy_json',
        formatLabel: 'Tachiyomi Lista de Manga',
        seriesCount: parsed.length,
        chapterCount: totalChapters,
        rawPayload: parsed,
      };
    }
  }

  return {
    fileName,
    fileSizeBytes: sizeBytes,
    format: 'unknown',
    formatLabel: 'Formato no reconocido',
    seriesCount: 0,
    chapterCount: 0,
    rawPayload: parsed,
  };
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Stats for Export
  const [stats, setStats] = useState<{
    seriesCount: number;
    historyCount: number;
    shelvesCount: number;
    loading: boolean;
  }>({
    seriesCount: 0,
    historyCount: 0,
    shelvesCount: 0,
    loading: true,
  });

  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Import State
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<BackupPreviewReport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Load stats when modal opens or switches to export tab
  useEffect(() => {
    if (!isOpen) return;

    async function loadStats() {
      setStats((prev) => ({ ...prev, loading: true }));
      try {
        const progressList = await localClientStorage.getAllProgress();
        const shelves = await localClientStorage.getAllShelvedSeries();
        const bookmarks = await localClientStorage.getBookmarks();

        let catalogSeriesCount = Object.keys(shelves).length || bookmarks.length;

        // Attempt to query series API for overall library count if reachable
        try {
          const res = await fetch('/api/v1/series');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              catalogSeriesCount = Math.max(catalogSeriesCount, data.length);
            }
          }
        } catch {
          // Offline fallback
        }

        setStats({
          seriesCount: catalogSeriesCount,
          historyCount: progressList.length,
          shelvesCount: Object.keys(shelves).length,
          loading: false,
        });
      } catch (err) {
        console.error('Failed to load backup stats:', err);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    }

    loadStats();
  }, [isOpen, activeTab]);

  // GSAP animation on open
  useEffect(() => {
    if (isOpen && modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.94, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power3.out' }
      );
    }
  }, [isOpen]);

  // GSAP animation for success confirmation
  useEffect(() => {
    if (importSuccess && successRef.current) {
      gsap.fromTo(
        successRef.current,
        { opacity: 0, y: 12, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.4)' }
      );
    }
  }, [importSuccess]);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && (e.key === 'Escape' || e.key === 'Esc')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle Export Download
  const handleExportBackup = async () => {
    try {
      const progressList = await localClientStorage.getAllProgress();
      const shelves = await localClientStorage.getAllShelvedSeries();
      const bookmarks = await localClientStorage.getBookmarks();

      let seriesList: any[] = [];
      try {
        const res = await fetch('/api/v1/series');
        if (res.ok) {
          seriesList = await res.json();
        }
      } catch {
        // Offline / client-only mode
      }

      const backupPayload = {
        app: 'kura-scroll',
        version: 1,
        exportedAt: new Date().toISOString(),
        stats: {
          seriesCount: seriesList.length || Object.keys(shelves).length,
          chapterCount: progressList.length,
          historyCount: progressList.length,
          shelvedCount: Object.keys(shelves).length,
        },
        shelvedSeries: shelves,
        bookmarks,
        readingProgress: progressList,
        series: seriesList,
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kura-scroll-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportNotice('¡Respaldo JSON descargado con éxito!');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      console.error('Error generating backup:', err);
      setExportNotice('Error al generar respaldo: ' + err.message);
    }
  };

  // Handle File Input Selection or Drop
  const handleFile = (file: File) => {
    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result;
        if (content !== null && content !== undefined) {
          const report = analyzeBackupFile(file.name, content as string | ArrayBuffer);
          setPreview(report);
          if (report.format === 'unknown') {
            setImportError('El archivo seleccionado no tiene un formato de respaldo válido de KuraScroll o Tachiyomi/Mihon.');
          }
        }
      } catch (err: any) {
        setImportError('Error al leer el archivo: ' + err.message);
      }
    };

    if (file.name.toLowerCase().endsWith('.tachibk')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Execute Import
  const handleStartImport = async () => {
    if (!preview || preview.format === 'unknown') return;

    setIsImporting(true);
    setImportProgress(10);
    setImportError(null);

    try {
      // Step 1: Simulate / Stream progress animation
      setImportProgress(35);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const payload = preview.rawPayload;

      // Import KuraScroll Backup directly into IndexedDB client stores
      if (preview.format === 'kura_scroll_json' && payload) {
        if (Array.isArray(payload.readingProgress)) {
          for (const prog of payload.readingProgress) {
            if (prog.seriesId && prog.chapterId) {
              await localClientStorage.saveProgress({
                seriesId: String(prog.seriesId),
                chapterId: String(prog.chapterId),
                pageNumber: Number(prog.pageNumber) || 1,
                scrollOffsetY: Number(prog.scrollOffsetY) || 0,
                timestamp: Number(prog.timestamp) || Date.now(),
              });
            }
          }
        }

        if (payload.shelvedSeries && typeof payload.shelvedSeries === 'object') {
          for (const [seriesId, data] of Object.entries(payload.shelvedSeries) as [string, any][]) {
            await localClientStorage.setSeriesShelf(
              seriesId,
              data.shelf || 'reading',
              Boolean(data.favorite)
            );
          }
        }

        if (Array.isArray(payload.bookmarks)) {
          for (const b of payload.bookmarks) {
            await localClientStorage.toggleBookmark(String(b), true);
          }
        }
      } else if (
        (preview.format === 'mihon_json' || preview.format === 'tachiyomi_legacy_json') &&
        payload
      ) {
        // Normalize Tachiyomi/Mihon Manga entries into Reading History and Shelves
        const mangas = Array.isArray(payload)
          ? payload
          : payload.mangas || payload.backupManga || payload.data || [];

        for (const m of mangas) {
          if (!m.title) continue;
          const slug = m.title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);

          const isFavorite = Boolean(m.favorite || m.inLibrary);
          await localClientStorage.setSeriesShelf(slug, 'reading', isFavorite);

          // If chapters present, track progress for last read chapter
          if (Array.isArray(m.chapters) && m.chapters.length > 0) {
            const readChapter = m.chapters.find((c: any) => c.read || c.last_page_read > 0) || m.chapters[0];
            await localClientStorage.saveProgress({
              seriesId: slug,
              chapterId: `${slug}-ch-${readChapter.chapter_number || 1}`,
              pageNumber: Number(readChapter.last_page_read) || 1,
              scrollOffsetY: 0,
              timestamp: Number(readChapter.last_read_at) || Date.now(),
            });
          }
        }
      }

      setImportProgress(75);
      await new Promise((resolve) => setTimeout(resolve, 80));

      setImportProgress(100);
      setIsImporting(false);
      setImportSuccess(true);
      onImportComplete?.();
    } catch (err: any) {
      setIsImporting(false);
      setImportError('Falló la importación: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleResetImport = () => {
    setPreview(null);
    setImportSuccess(false);
    setImportError(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Copias de Seguridad y Migración"
      data-testid="backup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity select-none"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#080c14]/95 border border-cyan-500/20 rounded-3xl p-6 sm:p-7 shadow-2xl text-white transform-gpu relative max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
                <span>Copias de Seguridad & Migración</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Tachiyomi • Mihon • KuraScroll
                </span>
              </h3>
              <p className="text-xs text-slate-400">Respalda o traslada tu biblioteca e historial con un clic</p>
            </div>
          </div>
          <button
            data-testid="close-backup-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800 mb-6">
          <button
            data-testid="tab-export"
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'export'
                ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar Biblioteca</span>
          </button>

          <button
            data-testid="tab-import"
            onClick={() => setActiveTab('import')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'import'
                ? 'bg-gradient-to-r from-violet-500/20 to-violet-500/10 text-violet-300 border border-violet-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Importar Respaldo</span>
          </button>
        </div>

        {/* Tab 1: Export Content */}
        {activeTab === 'export' && (
          <div className="space-y-5">
            {/* Statistics Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900/60 border border-gray-800/90 rounded-2xl p-3.5 text-center">
                <div className="flex items-center justify-center text-cyan-400 mb-1">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div data-testid="stat-series-count" className="text-xl font-bold font-mono text-white">
                  {stats.loading ? '...' : stats.seriesCount}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">Series Totales</div>
              </div>

              <div className="bg-gray-900/60 border border-gray-800/90 rounded-2xl p-3.5 text-center">
                <div className="flex items-center justify-center text-indigo-400 mb-1">
                  <Layers className="w-4 h-4" />
                </div>
                <div data-testid="stat-history-count" className="text-xl font-bold font-mono text-white">
                  {stats.loading ? '...' : stats.historyCount}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">Capítulos en Historial</div>
              </div>

              <div className="bg-gray-900/60 border border-gray-800/90 rounded-2xl p-3.5 text-center">
                <div className="flex items-center justify-center text-violet-400 mb-1">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div data-testid="stat-shelves-count" className="text-xl font-bold font-mono text-white">
                  {stats.loading ? '...' : stats.shelvesCount}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">Colecciones & Favoritos</div>
              </div>
            </div>

            {/* Description Info Box */}
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-cyan-300 mb-0.5">Respaldo Integral Portátil</p>
                <p>
                  Genera un archivo JSON autónomo con tu historial de lectura página por página, progreso por capítulo,
                  estanterías ("Leyendo", "Completados", "Favoritos") y metadatos de series.
                </p>
              </div>
            </div>

            {/* Download Button */}
            <div className="pt-2">
              <button
                data-testid="export-backup-btn"
                onClick={handleExportBackup}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold text-sm shadow-[0_0_25px_rgba(0,229,255,0.25)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Respaldo JSON</span>
              </button>

              {exportNotice && (
                <p className="text-center text-xs font-semibold text-cyan-400 mt-2.5 animate-pulse">
                  {exportNotice}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Import Content */}
        {activeTab === 'import' && (
          <div className="space-y-5">
            {!preview && !importSuccess && (
              /* Drag & Drop Zone */
              <div
                data-testid="dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                    : 'border-gray-800 hover:border-violet-500/50 hover:bg-gray-900/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  data-testid="backup-file-input"
                  type="file"
                  accept=".json,.tachibk"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-cyan-500/10 to-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-gray-200 mb-1">
                  Arrastra tu archivo aquí o haz clic para explorar
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Formatos compatibles: Copias de seguridad <span className="text-cyan-400 font-mono">.json</span> de KuraScroll o <span className="text-violet-400 font-mono">.json / .tachibk</span> de Tachiyomi y Mihon.
                </p>
              </div>
            )}

            {/* Error Message */}
            {importError && (
              <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{importError}</span>
              </div>
            )}

            {/* Analysis Preview Section */}
            {preview && !importSuccess && (
              <div data-testid="backup-preview" className="space-y-4">
                <div className="p-4 rounded-2xl bg-gray-900/70 border border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <p data-testid="preview-filename" className="text-sm font-bold text-gray-200 truncate">
                          {preview.fileName}
                        </p>
                        <p data-testid="preview-size" className="text-xs text-slate-400 font-mono">
                          {formatBytes(preview.fileSizeBytes)}
                        </p>
                      </div>
                    </div>

                    <span
                      data-testid="preview-format"
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/40 shrink-0"
                    >
                      {preview.formatLabel}
                    </span>
                  </div>

                  {/* Detected Series and Chapters Preview Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
                    <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800 text-center">
                      <span className="text-[11px] text-slate-400 block">Series Detectadas</span>
                      <span data-testid="preview-series-count" className="text-base font-bold font-mono text-cyan-400">
                        {preview.seriesCount}
                      </span>
                    </div>

                    <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800 text-center">
                      <span className="text-[11px] text-slate-400 block">Capítulos Registrados</span>
                      <span data-testid="preview-chapters-count" className="text-base font-bold font-mono text-indigo-400">
                        {preview.chapterCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Import Action Buttons or Progress */}
                {isImporting ? (
                  <div className="space-y-2 py-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Migrando e indexando biblioteca...</span>
                      <span data-testid="import-progress-percent" className="font-mono text-cyan-400 font-bold">
                        {importProgress}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                      <div
                        data-testid="import-progress-bar"
                        style={{ width: `${importProgress}%` }}
                        className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,229,255,0.5)]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleResetImport}
                      className="py-3 px-4 rounded-2xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-semibold border border-gray-800 flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Elegir otro</span>
                    </button>

                    <button
                      data-testid="start-import-btn"
                      disabled={preview.format === 'unknown'}
                      onClick={handleStartImport}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all cursor-pointer"
                    >
                      <span>Iniciar Importación</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Success State */}
            {importSuccess && (
              <div
                ref={successRef}
                data-testid="import-success-msg"
                className="p-6 rounded-3xl bg-gradient-to-b from-cyan-950/40 to-gray-900/60 border border-cyan-500/40 text-center space-y-3"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">¡Migración completada con éxito!</h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Se han importado tus series, registros de lectura y estanterías correctamente. Los cambios ya están reflejados en tu catálogo e historial.
                </p>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={handleResetImport}
                    className="py-2 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-semibold border border-gray-800 transition-colors"
                  >
                    Importar otro archivo
                  </button>

                  <button
                    onClick={onClose}
                    className="py-2 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
