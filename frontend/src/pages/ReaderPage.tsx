import React, { useState, useEffect } from 'react';
import { WebtoonReader } from '../components/reader/WebtoonReader.js';
import { MangaReader } from '../components/reader/MangaReader.js';
import { ReaderControls } from '../components/reader/ReaderControls.js';
import { ThumbnailScrubber } from '../components/reader/ThumbnailScrubber.js';
import {
  ChapterQuickNavDrawer,
  QuickIndexData,
  SeriesBookmarkItem,
} from '../components/reader/ChapterQuickNavDrawer.js';
import {
  ReaderVisualSettingsModal,
  ReaderDisplaySettings,
  loadReaderDisplaySettings,
} from '../components/reader/ReaderVisualSettingsModal.js';
import { useReadingProgress } from '../hooks/useReadingProgress.js';
import { useAutoScroll } from '../hooks/useAutoScroll.js';
import { useZenModeGSAP } from '../hooks/useZenModeGSAP.js';
import { ReadingStatsTracker } from '../services/reading-stats-service.js';
import { syncCoordinator } from '../services/sync-coordinator.js';
import { AdaptivePrefetchEngine, PrefetchTelemetry } from '../reader/AdaptivePrefetchEngine.js';
import { AmbilightBackdrop } from '../components/reader/AmbilightBackdrop.js';
import {
  extractAmbientColor,
  DEFAULT_AMBIENT_RGB,
  RGBColor,
  shouldBypassAmbilight,
} from '../utils/ambient-color-extractor.js';

export interface ReaderPageProps {
  chapterId: string;
  onBack: () => void;
  onSelectChapter: (newChapterId: string) => void;
}

export const ReaderPage: React.FC<ReaderPageProps> = ({
  chapterId,
  onBack,
  onSelectChapter,
}) => {
  const [manifest, setManifest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [readerMode, setReaderMode] = useState<'webtoon' | 'manga-rtl' | 'manga-ltr'>('webtoon');
  const [showControls, setShowControls] = useState(true);
  const [isScrubberOpen, setIsScrubberOpen] = useState(false);
  const [doublePage, setDoublePage] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kura-scroll-double-page') === 'true';
    } catch {
      return false;
    }
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isVisualSettingsOpen, setIsVisualSettingsOpen] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<ReaderDisplaySettings>(() =>
    loadReaderDisplaySettings()
  );
  const [readingBackground, setReadingBackground] = useState<string>(() => {
    try {
      return localStorage.getItem('kura-scroll-reader-bg') || '#080c14';
    } catch {
      return '#080c14';
    }
  });

  const [readingTracker] = useState(() => new ReadingStatsTracker(18));
  const [readingPaceText, setReadingPaceText] = useState<string>('');

  // Sprint 38: Smart Pre-caching & Bandwidth-Aware Engine
  const [prefetchEngine] = useState(() => new AdaptivePrefetchEngine(300));
  const [prefetchTelemetry, setPrefetchTelemetry] = useState<PrefetchTelemetry>(() =>
    prefetchEngine.getTelemetry()
  );

  // Sprint 39: Dynamic Ambient Ambilight Glow State (Intel GMA 4500MHD Target)
  const [ambientColor, setAmbientColor] = useState<RGBColor>(DEFAULT_AMBIENT_RGB);

  // Sprint 34: Chapter Quick Navigation & Bookmarks State
  const [isChapterNavOpen, setIsChapterNavOpen] = useState(false);
  const [quickIndexData, setQuickIndexData] = useState<QuickIndexData | null>(null);
  const [seriesBookmarks, setSeriesBookmarks] = useState<SeriesBookmarkItem[]>([]);
  const [bookmarkToast, setBookmarkToast] = useState<string | null>(null);

  const autoScroll = useAutoScroll({
    speed: 50,
    pauseOnUserInteraction: true,
  });

  const {
    isZen,
    toggleZen,
    registerUiElement,
    canvasRef,
    ambilightRef,
  } = useZenModeGSAP({
    enableNativeFullscreen: true,
    lowResourceMode: displaySettings?.thermalSaverEnabled || false,
  });

  const handleBackgroundChange = (bg: string) => {
    setReadingBackground(bg);
    try {
      localStorage.setItem('kura-scroll-reader-bg', bg);
    } catch {
      // LocalStorage access restricted in certain sandbox frames
    }
  };

  const seriesId = manifest?.chapter?.seriesId || '';
  const { saveProgress } = useReadingProgress(seriesId);

  useEffect(() => {
    async function loadChapter() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/chapters/${chapterId}`);
        if (res.ok) {
          const data = await res.json();
          setManifest(data);
          setCurrentPage(1);

          // Infer default mode: Korean manhwa -> webtoon, Japanese manga -> manga-rtl
          if (data.chapter?.storagePath?.includes('manhwa')) {
            setReaderMode('webtoon');
          }
        }
      } catch (e) {
        console.error('Failed to load chapter manifest:', e);
      } finally {
        setLoading(false);
      }
    }

    loadChapter();
  }, [chapterId]);

  const handlePageChange = (page: number) => {
    const pageCount = manifest?.pages?.length ?? 1;
    if (!Number.isSafeInteger(page) || pageCount < 1) return;
    const nextPage = Math.min(pageCount, Math.max(1, page));
    if (nextPage === currentPage) return;

    setCurrentPage(nextPage);
    saveProgress(chapterId, nextPage, 0, nextPage === pageCount);

    const duration = readingTracker.recordPageAdvance();
    if (duration >= 1.5 && duration <= 300 && seriesId) {
      fetch('/api/v1/analytics/velocity/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'local_user',
          seriesId,
          durationSeconds: duration,
        }),
      }).catch(() => {});
    }

    const total = manifest?.pages?.length || 1;
    const estimate = readingTracker.estimateRemainingChapterTime(nextPage, total);
    setReadingPaceText(estimate.formattedRemaining);

    // Sprint 39: Update Ambient Glow with Chromatic Hysteresis (only when enabled)
    if (displaySettings?.ambilightEnabled && !shouldBypassAmbilight(displaySettings?.thermalSaverEnabled)) {
      setTimeout(() => {
        if (typeof document !== 'undefined') {
          const activeImg = document.querySelector<HTMLImageElement>(`img[alt="Página ${nextPage}"]`);
          if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
            setAmbientColor((prev) => {
              const res = extractAmbientColor(activeImg, prev);
              return res.rgb;
            });
          }
        }
      }, 150);
    }
  };

  // Sprint 38: Trigger adaptive prefetch on page position updates
  useEffect(() => {
    if (manifest?.pages && manifest.pages.length > 0) {
      const pageFileNames = manifest.pages.map((p: any) => p.fileName);
      const emaVelocity = readingTracker.getAverageSecondsPerPage();
      prefetchEngine.updatePosition(
        chapterId,
        currentPage - 1,
        manifest.pages.length,
        pageFileNames,
        emaVelocity
      );
      setPrefetchTelemetry(prefetchEngine.getTelemetry());
    }
  }, [chapterId, currentPage, manifest, prefetchEngine, readingTracker]);

  useEffect(() => {
    return () => {
      prefetchEngine.dispose();
    };
  }, [prefetchEngine]);

  const handleSelectPageFromScrubber = (pageNumber: number) => {
    handlePageChange(pageNumber);
    if (readerMode === 'webtoon') {
      const el = document.getElementById(`page-${pageNumber}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const fetchQuickNavData = async (sId: string) => {
    if (!sId) return;
    try {
      const [indexRes, bmRes] = await Promise.all([
        fetch(`/api/v1/series/${sId}/chapters/quick-index`),
        fetch(`/api/v1/series/${sId}/bookmarks`),
      ]);
      if (indexRes.ok) setQuickIndexData(await indexRes.json());
      if (bmRes.ok) {
        const bmJson = await bmRes.json();
        setSeriesBookmarks(bmJson.bookmarks || []);
      }
    } catch (e) {
      console.error('Failed to fetch quick navigation or bookmarks:', e);
    }
  };

  useEffect(() => {
    if (seriesId) {
      fetchQuickNavData(seriesId);
    }
  }, [seriesId]);

  const handleToggleActiveBookmark = async () => {
    if (!seriesId || !chapterId) return;
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await syncCoordinator.enqueue('CREATE_BOOKMARK', {
          seriesId,
          chapterId,
          pageIndex: currentPage,
        });
        setBookmarkToast(`Página ${currentPage} guardada en marcadores (offline)`);
        setTimeout(() => setBookmarkToast(null), 2500);
        return;
      }

      const res = await fetch('/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId,
          chapterId,
          pageIndex: currentPage,
        }),
      });
      if (res.ok) {
        setBookmarkToast(`Página ${currentPage} guardada en marcadores`);
        setTimeout(() => setBookmarkToast(null), 2500);
        fetchQuickNavData(seriesId);
      } else {
        throw new Error('Bookmark request failed');
      }
    } catch {
      await syncCoordinator.enqueue('CREATE_BOOKMARK', {
        seriesId,
        chapterId,
        pageIndex: currentPage,
      });
      setBookmarkToast(`Página ${currentPage} guardada en marcadores (local)`);
      setTimeout(() => setBookmarkToast(null), 2500);
    }
  };

  const handleDeleteBookmark = async (bookmarkId: number) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await syncCoordinator.enqueue('DELETE_BOOKMARK', { bookmarkId });
        setSeriesBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
        return;
      }
      const res = await fetch(`/api/v1/bookmarks/${bookmarkId}`, { method: 'DELETE' });
      if (res.ok) {
        setSeriesBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
        if (seriesId) fetchQuickNavData(seriesId);
      } else {
        throw new Error('Delete bookmark failed');
      }
    } catch {
      await syncCoordinator.enqueue('DELETE_BOOKMARK', { bookmarkId });
      setSeriesBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    }
  };

  // Global Keyboard shortcuts: C for Drawer, B for Bookmark
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'c' || e.key === 'C') {
        setIsChapterNavOpen((prev) => !prev);
      } else if (e.key === 'b' || e.key === 'B') {
        handleToggleActiveBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [seriesId, chapterId, currentPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Cargando capítulo...</p>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <p className="text-gray-400 mb-4">No se pudo cargar el capítulo.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm"
        >
          Volver
        </button>
      </div>
    );
  }

  const storageBaseUrl = `/storage/${manifest.chapter.storagePath}`;
  const totalPages = manifest.pages?.length || 1;

  const handleToggleDoublePage = (enabled: boolean) => {
    setDoublePage(enabled);
    try {
      localStorage.setItem('kura-scroll-double-page', String(enabled));
    } catch {}
  };

  const cycleReaderMode = () => {
    setReaderMode((prev) => {
      if (prev === 'webtoon') return 'manga-rtl';
      if (prev === 'manga-rtl') return 'manga-ltr';
      return 'webtoon';
    });
  };

  const cycleBackgroundTheme = () => {
    const themes = ['#080c14', '#000000', '#1a1612'];
    const currentIndex = themes.indexOf(readingBackground);
    const nextIndex = (currentIndex + 1) % themes.length;
    handleBackgroundChange(themes[nextIndex]);
  };

  return (
    <div
      className="min-h-screen text-white relative transition-colors duration-200"
      style={{ backgroundColor: readingBackground }}
    >
      {/* Hardware-Accelerated Dynamic Ambient Ambilight Glow Backdrop (Sprint 39) */}
      <AmbilightBackdrop
        ambientColor={ambientColor}
        enabled={isZen || displaySettings?.ambilightEnabled !== false}
        opacity={displaySettings?.ambilightIntensity ? (displaySettings.ambilightIntensity / 100) * 0.32 : 0.28}
        theme={readingBackground}
        thermalSaverActive={displaySettings?.thermalSaverEnabled || false}
      />

      {/* Zen Mode Ambilight Ambient Aura Backdrop (Sprint 23 GSAP ref) */}
      <div
        ref={ambilightRef}
        data-testid="zen-ambilight-backdrop"
        className={`pointer-events-none fixed inset-0 transition-opacity duration-700 z-0 ${
          isZen ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.09) 55%, transparent 85%)',
        }}
      />

      {/* Floating Header Controls */}
      {showControls && (
        <div ref={registerUiElement} className="relative z-30">
          <ReaderControls
            seriesTitle={manifest.chapter.seriesId}
            chapterNumber={manifest.chapter.chapterNumber}
            chapterTitle={manifest.chapter.title}
            readerMode={readerMode}
            prevChapterId={manifest.prevChapterId}
            nextChapterId={manifest.nextChapterId}
            onBack={onBack}
            onSelectChapter={onSelectChapter}
            onChangeMode={setReaderMode}
            currentBackground={readingBackground}
            onChangeBackground={handleBackgroundChange}
            currentPage={currentPage}
            totalPages={totalPages}
            isScrubberOpen={isScrubberOpen}
            onToggleScrubber={() => setIsScrubberOpen((prev) => !prev)}
            doublePage={doublePage}
            onToggleDoublePage={handleToggleDoublePage}
            onOpenShortcuts={() => setShowShortcuts(true)}
            isVisualSettingsOpen={isVisualSettingsOpen}
            onOpenVisualSettings={() => setIsVisualSettingsOpen(true)}
            isAutoScrollActive={autoScroll.isActive}
            onToggleAutoScroll={readerMode === 'webtoon' ? autoScroll.toggle : undefined}
            readingPaceText={readingPaceText}
            averageSecondsPerPage={readingTracker.getAverageSecondsPerPage()}
            isZenMode={isZen}
            onToggleZenMode={toggleZen}
            isChapterNavOpen={isChapterNavOpen}
            onToggleChapterNav={() => setIsChapterNavOpen((prev) => !prev)}
            onToggleBookmark={handleToggleActiveBookmark}
            prefetchStatus={{
              isPrefetching: prefetchTelemetry.isPrefetching,
              tier: prefetchTelemetry.currentTier,
              windowForward: prefetchTelemetry.windowForward,
            }}
          />
        </div>
      )}

      {/* Main Reader Engine Canvas */}
      <div
        ref={canvasRef}
        className="pt-16 pb-12 cursor-default relative z-10"
        onClick={() => setShowControls((prev) => !prev)}
      >
        {readerMode === 'webtoon' ? (
          <WebtoonReader
            pages={manifest.pages}
            storageBaseUrl={storageBaseUrl}
            onPageVisible={handlePageChange}
            displaySettings={displaySettings}
          />
        ) : (
          <MangaReader
            pages={manifest.pages}
            currentPage={currentPage}
            mode={readerMode === 'manga-rtl' ? 'RTL' : 'LTR'}
            storageBaseUrl={storageBaseUrl}
            onPageChange={handlePageChange}
            onToggleControls={() => setShowControls((prev) => !prev)}
            doublePage={doublePage}
            onToggleDoublePage={handleToggleDoublePage}
            showShortcutsHUD={showShortcuts}
            onToggleShortcutsHUD={setShowShortcuts}
            onCycleMode={cycleReaderMode}
            onCycleTheme={cycleBackgroundTheme}
            displaySettings={displaySettings}
            onOpenVisualSettings={() => setIsVisualSettingsOpen(true)}
          />
        )}
      </div>

      {/* Bottom Horizontal Thumbnail Scrubber Drawer */}
      <ThumbnailScrubber
        pages={manifest.pages || []}
        currentPage={currentPage}
        storageBaseUrl={storageBaseUrl}
        isOpen={isScrubberOpen}
        onSelectPage={handleSelectPageFromScrubber}
        onClose={() => setIsScrubberOpen(false)}
        onToggle={() => setIsScrubberOpen((prev) => !prev)}
      />

      {/* Visual Customizer & Ambilight Modal */}
      <ReaderVisualSettingsModal
        isOpen={isVisualSettingsOpen}
        onClose={() => setIsVisualSettingsOpen(false)}
        settings={displaySettings}
        onChangeSettings={setDisplaySettings}
        readerMode={readerMode}
      />

      {/* Chapter Quick-Navigation & Bookmarks Flyout Drawer (Sprint 34) */}
      <ChapterQuickNavDrawer
        isOpen={isChapterNavOpen}
        onClose={() => setIsChapterNavOpen(false)}
        seriesId={seriesId}
        currentChapterId={chapterId}
        currentPage={currentPage}
        onSelectChapter={(newChId, page) => {
          onSelectChapter(newChId);
          if (page) setCurrentPage(page);
        }}
        quickIndexData={quickIndexData}
        bookmarks={seriesBookmarks}
        onDeleteBookmark={handleDeleteBookmark}
        onToggleActiveBookmark={handleToggleActiveBookmark}
      />

      {/* Instant Bookmark Toast Feedback */}
      {bookmarkToast && (
        <div
          data-testid="bookmark-toast"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-lg bg-zinc-900/95 border border-zinc-700/80 text-zinc-100 text-xs font-medium shadow-xl flex items-center gap-2 transition-all duration-200"
        >
          <span>{bookmarkToast}</span>
        </div>
      )}
    </div>
  );
};
