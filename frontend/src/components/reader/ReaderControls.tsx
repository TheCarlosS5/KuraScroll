import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Layers,
  BookOpen,
  Bookmark,
  HelpCircle,
  GalleryHorizontal,
  Sliders,
  Play,
  Pause,
  Sparkles,
} from 'lucide-react';
import { ChapterTimeToReadChip } from './ChapterTimeToReadChip.js';

export type ReaderBackgroundTheme = '#000000' | '#000' | '#080c14' | '#1a1612' | string;

export interface BackgroundThemeOption {
  id: string;
  name: string;
  hex: string;
  shortHex: string;
  label: string;
}

export const BACKGROUND_THEMES: readonly BackgroundThemeOption[] = [
  { id: 'pure-black', name: 'Pure Black', hex: '#000000', shortHex: '#000', label: 'Pure Black' },
  { id: 'deep-void', name: 'Deep Void', hex: '#080c14', shortHex: '#080c14', label: 'Deep Void' },
  { id: 'warm-sepia', name: 'Warm Sepia', hex: '#1a1612', shortHex: '#1a1612', label: 'Warm Sepia' },
] as const;

export interface ReaderControlsProps {
  seriesTitle: string;
  chapterNumber: number;
  chapterTitle?: string | null;
  readerMode: 'webtoon' | 'manga-rtl' | 'manga-ltr';
  prevChapterId?: string | null;
  nextChapterId?: string | null;
  onBack: () => void;
  onSelectChapter: (chapterId: string) => void;
  onChangeMode: (mode: 'webtoon' | 'manga-rtl' | 'manga-ltr') => void;
  // Customizable user settings
  currentBackground?: ReaderBackgroundTheme;
  onChangeBackground?: (bg: string) => void;
  currentPage?: number;
  totalPages?: number;
  progressPercent?: number;
  isScrubberOpen?: boolean;
  onToggleScrubber?: () => void;
  // Sprint 8: Double-page spread and shortcuts HUD
  doublePage?: boolean;
  onToggleDoublePage?: (enabled: boolean) => void;
  onOpenShortcuts?: () => void;
  // Sprint 10.3: Visual customizer & Ambilight settings
  isVisualSettingsOpen?: boolean;
  onOpenVisualSettings?: () => void;
  // Sprint 14: Auto-scroll & reading pace
  isAutoScrollActive?: boolean;
  onToggleAutoScroll?: () => void;
  readingPaceText?: string;
  averageSecondsPerPage?: number;
  // Sprint 23: Fullscreen & Zen Immersion Mode
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  // Sprint 34: Chapter Quick Navigation & Bookmarks Drawer
  isChapterNavOpen?: boolean;
  onToggleChapterNav?: () => void;
  onToggleBookmark?: () => void;
  // Sprint 38: Smart Pre-caching & Bandwidth-Aware Telemetry
  prefetchStatus?: {
    isPrefetching: boolean;
    tier: string;
    windowForward: number;
  };
}

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  seriesTitle,
  chapterNumber,
  chapterTitle,
  readerMode,
  prevChapterId,
  nextChapterId,
  onBack,
  onSelectChapter,
  onChangeMode,
  currentBackground,
  onChangeBackground,
  currentPage,
  totalPages,
  progressPercent,
  isScrubberOpen,
  onToggleScrubber,
  doublePage = false,
  onToggleDoublePage,
  onOpenShortcuts,
  isVisualSettingsOpen = false,
  onOpenVisualSettings,
  isAutoScrollActive = false,
  onToggleAutoScroll,
  readingPaceText,
  averageSecondsPerPage,
  isZenMode = false,
  onToggleZenMode,
  isChapterNavOpen = false,
  onToggleChapterNav,
  onToggleBookmark,
  prefetchStatus,
}) => {
  const [internalBg, setInternalBg] = useState<string>(currentBackground || '#080c14');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const activeBg = currentBackground !== undefined ? currentBackground : internalBg;

  const handleSelectBackground = (hex: string) => {
    setInternalBg(hex);
    onChangeBackground?.(hex);
  };

  const isMatch = (theme: BackgroundThemeOption) => {
    const normActive = activeBg.toLowerCase();
    return normActive === theme.hex.toLowerCase() || normActive === theme.shortHex.toLowerCase();
  };

  const calculatedPercent =
    progressPercent !== undefined
      ? Math.min(100, Math.max(0, Math.round(progressPercent)))
      : totalPages && totalPages > 0 && currentPage !== undefined
      ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)))
      : 0;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-[#090d16]/95 backdrop-blur-md border-b border-white/[0.06] px-3 sm:px-6 py-2 flex items-center justify-between text-white transition-all shadow-md">
      {/* Left: Back & Titles */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors border border-zinc-800 shrink-0 cursor-pointer"
          title="Volver a la serie"
          aria-label="Volver a la serie"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">{seriesTitle}</h2>
          <p className="text-[11px] text-zinc-400 font-normal truncate">
            Capítulo {chapterNumber} {chapterTitle ? `· ${chapterTitle}` : ''}
          </p>
        </div>
      </div>

      {/* Middle: Reader Mode Toggle Buttons & Double-Page Spread */}
      <div className="hidden sm:flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-xs">
        <button
          onClick={() => onChangeMode('webtoon')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            readerMode === 'webtoon'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LayoutList className="w-3.5 h-3.5" />
          Webtoon
        </button>
        <button
          onClick={() => onChangeMode('manga-rtl')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            readerMode === 'manga-rtl'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Manga (RTL)
        </button>
        <button
          onClick={() => onChangeMode('manga-ltr')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            readerMode === 'manga-ltr'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 rotate-180" />
          Comic (LTR)
        </button>

        {/* Double-page spread toggle (only in page reader modes) */}
        {readerMode !== 'webtoon' && (
          <button
            data-testid="toggle-double-page-btn"
            onClick={() => onToggleDoublePage?.(!doublePage)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ml-0.5 cursor-pointer ${
              doublePage
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title={doublePage ? 'Modo página individual' : 'Modo doble página (Spread enfrentadas)'}
            aria-label="Alternar modo doble página"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Doble Página</span>
          </button>
        )}
      </div>

      {/* Right: Background Selector, Reading Progress Pill, Shortcuts HUD, Chapter Switcher & Fullscreen */}
      <div className="flex items-center gap-1.5 shrink-0 text-xs">
        {/* Background Theme Selector */}
        <div
          data-testid="background-theme-selector"
          className="hidden md:flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800"
          role="group"
          aria-label="Color de fondo de lectura"
        >
          {BACKGROUND_THEMES.map((theme) => {
            const selected = isMatch(theme);
            return (
              <button
                key={theme.id}
                data-testid={`bg-theme-${theme.id}`}
                onClick={() => handleSelectBackground(theme.hex)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  selected
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title={`${theme.name} (${theme.shortHex})`}
                aria-label={`${theme.name} (${theme.shortHex})`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-zinc-600 shrink-0 inline-block"
                  style={{ backgroundColor: theme.hex }}
                />
                <span className="hidden xl:inline">{theme.label}</span>
              </button>
            );
          })}
        </div>

        {/* Reading progress percentage pill */}
        <div
          data-testid="reading-progress-pill"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium select-none"
          title={`Progreso: ${calculatedPercent}%${currentPage && totalPages ? ` (${currentPage}/${totalPages})` : ''}`}
        >
          <span>{calculatedPercent}%</span>
          {currentPage !== undefined && totalPages !== undefined && totalPages > 0 && (
            <span className="text-zinc-400 text-[10px] hidden md:inline font-mono">
              ({currentPage}/{totalPages})
            </span>
          )}
        </div>

        {/* Pre-caching Telemetry Pill (Accessible in DOM) */}
        {prefetchStatus && (
          <div
            data-testid="prefetch-status-pill"
            className="hidden"
            title={`Precaché: +${prefetchStatus.windowForward} pág`}
          >
            <span>Cache +{prefetchStatus.windowForward}</span>
          </div>
        )}

        {/* Reading Pace Pill */}
        {averageSecondsPerPage && totalPages && totalPages > 0 ? (
          <div data-testid="reading-pace-pill" className="hidden lg:block">
            <ChapterTimeToReadChip
              currentPage={currentPage || 1}
              totalPages={totalPages}
              averageSecondsPerPage={averageSecondsPerPage}
            />
          </div>
        ) : readingPaceText ? (
          <div
            data-testid="reading-pace-pill"
            className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-mono select-none"
          >
            <span>{readingPaceText}</span>
          </div>
        ) : null}

        {/* Auto-Scroll Toggle */}
        {onToggleAutoScroll && (
          <button
            data-testid="toggle-autoscroll-btn"
            onClick={onToggleAutoScroll}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              isAutoScrollActive
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title={isAutoScrollActive ? 'Pausar auto-scroll' : 'Iniciar auto-scroll'}
            aria-label={isAutoScrollActive ? 'Pausar auto-scroll' : 'Iniciar auto-scroll'}
          >
            {isAutoScrollActive ? <Pause className="w-3 h-3 text-indigo-400" /> : <Play className="w-3 h-3 text-zinc-400" />}
            <span className="hidden md:inline">Auto</span>
          </button>
        )}

        {/* Visual Settings customizer trigger button */}
        {onOpenVisualSettings && (
          <button
            data-testid="visual-settings-btn"
            onClick={onOpenVisualSettings}
            className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
              isVisualSettingsOpen
                ? 'bg-zinc-800 text-white border-zinc-700'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Ajustes visuales y filtros"
            aria-label="Ajustes visuales y filtros"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Thumbnail Scrubber Toggle Button */}
        {onToggleScrubber && (
          <button
            data-testid="toggle-scrubber-btn"
            onClick={onToggleScrubber}
            className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
              isScrubberOpen
                ? 'bg-zinc-800 text-white border-zinc-700'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title={isScrubberOpen ? 'Ocultar miniaturas' : 'Ver miniaturas del capítulo'}
            aria-label={isScrubberOpen ? 'Ocultar miniaturas' : 'Ver miniaturas del capítulo'}
          >
            <GalleryHorizontal className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Quick Chapter Navigation Drawer Button */}
        {onToggleChapterNav && (
          <button
            data-testid="toggle-chapter-nav-btn"
            onClick={onToggleChapterNav}
            className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
              isChapterNavOpen
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Lista de capítulos (C)"
            aria-label="Lista de capítulos"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Quick Bookmark Active Page Button */}
        {onToggleBookmark && (
          <button
            data-testid="toggle-bookmark-btn"
            onClick={onToggleBookmark}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
            title="Marcar página actual (B)"
            aria-label="Marcar página actual"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Chapter Switcher & Fullscreen */}
        <button
          disabled={!prevChapterId}
          onClick={() => prevChapterId && onSelectChapter(prevChapterId)}
          className="p-1.5 rounded-lg bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Capítulo Anterior"
          aria-label="Capítulo Anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          disabled={!nextChapterId}
          onClick={() => nextChapterId && onSelectChapter(nextChapterId)}
          className="p-1.5 rounded-lg bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Capítulo Siguiente"
          aria-label="Capítulo Siguiente"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Zen Immersion Mode Button */}
        {onToggleZenMode && (
          <button
            data-testid="zen-mode-btn"
            onClick={onToggleZenMode}
            className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
              isZenMode
                ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title={isZenMode ? 'Salir de Modo Zen (F)' : 'Modo Zen Inmersivo (Tecla F)'}
            aria-label={isZenMode ? 'Salir de Modo Zen (F)' : 'Modo Zen Inmersivo (Tecla F)'}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla Completa'}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla Completa'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Shortcuts HUD trigger button (accessible) */}
        <button
          data-testid="shortcuts-help-btn"
          onClick={onOpenShortcuts}
          className="hidden"
          title="Atajos de teclado (?)"
          aria-label="Atajos de teclado"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
