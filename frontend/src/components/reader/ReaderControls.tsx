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
  // Sprint 23: Fullscreen & Zen Immersion Mode
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  // Sprint 34: Chapter Quick Navigation & Bookmarks Drawer
  isChapterNavOpen?: boolean;
  onToggleChapterNav?: () => void;
  onToggleBookmark?: () => void;
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
  isZenMode = false,
  onToggleZenMode,
  isChapterNavOpen = false,
  onToggleChapterNav,
  onToggleBookmark,
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
    <div className="fixed top-0 inset-x-0 z-50 bg-[#080c14]/95 backdrop-blur-md border-b border-gray-800 px-4 py-2.5 flex items-center justify-between text-white transition-all shadow-xl">
      {/* Left: Back & Titles */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white transition-colors border border-gray-800 shrink-0"
          title="Volver a la serie"
          aria-label="Volver a la serie"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-200 truncate">{seriesTitle}</h2>
          <p className="text-xs text-cyan-400 font-medium truncate">
            Capítulo {chapterNumber} {chapterTitle ? `• ${chapterTitle}` : ''}
          </p>
        </div>
      </div>

      {/* Middle: Reader Mode Toggle Buttons & Double-Page Spread */}
      <div className="hidden sm:flex items-center gap-1.5 bg-gray-900/90 p-1 rounded-xl border border-gray-800">
        <button
          onClick={() => onChangeMode('webtoon')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            readerMode === 'webtoon'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <LayoutList className="w-3.5 h-3.5" />
          Webtoon
        </button>
        <button
          onClick={() => onChangeMode('manga-rtl')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            readerMode === 'manga-rtl'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Manga (RTL)
        </button>
        <button
          onClick={() => onChangeMode('manga-ltr')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            readerMode === 'manga-ltr'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white'
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ml-1 ${
              doublePage
                ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'text-gray-400 hover:text-white border-transparent hover:bg-gray-800/60'
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
      <div className="flex items-center gap-2 shrink-0">
        {/* Background Theme Selector */}
        <div
          data-testid="background-theme-selector"
          className="flex items-center gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800"
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
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  selected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                    : 'text-gray-400 hover:text-white border border-transparent hover:bg-gray-800/60'
                }`}
                title={`${theme.name} (${theme.shortHex})`}
                aria-label={`${theme.name} (${theme.shortHex})`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-gray-600 shrink-0 inline-block"
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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-sm select-none"
          title={`Progreso: ${calculatedPercent}%${currentPage && totalPages ? ` (${currentPage}/${totalPages})` : ''}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>{calculatedPercent}%</span>
          {currentPage !== undefined && totalPages !== undefined && totalPages > 0 && (
            <span className="text-cyan-400/70 text-[10px] hidden md:inline font-mono">
              {currentPage}/{totalPages}
            </span>
          )}
        </div>

        {/* Reading Pace Estimate (Sprint 14) */}
        {readingPaceText && (
          <div
            data-testid="reading-pace-pill"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/60 text-slate-300 text-[11px] font-mono select-none"
            title="Velocidad y tiempo estimado de lectura"
          >
            <span>{readingPaceText}</span>
          </div>
        )}

        {/* Auto-Scroll Toggle (Sprint 14) */}
        {onToggleAutoScroll && (
          <button
            data-testid="toggle-autoscroll-btn"
            onClick={onToggleAutoScroll}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isAutoScrollActive
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-300 hover:text-white'
            }`}
            title={isAutoScrollActive ? 'Pausar auto-scroll' : 'Iniciar auto-scroll'}
            aria-label={isAutoScrollActive ? 'Pausar auto-scroll' : 'Iniciar auto-scroll'}
          >
            {isAutoScrollActive ? <Pause className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden md:inline">Auto</span>
          </button>
        )}

        {/* Shortcuts HUD trigger button */}
        <button
          data-testid="shortcuts-help-btn"
          onClick={onOpenShortcuts}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-cyan-400 transition-colors"
          title="Atajos de teclado (?)"
          aria-label="Atajos de teclado"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Visual Settings customizer trigger button */}
        {onOpenVisualSettings && (
          <button
            data-testid="visual-settings-btn"
            onClick={onOpenVisualSettings}
            className={`p-2 rounded-xl transition-all border ${
              isVisualSettingsOpen
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-400 hover:text-cyan-400'
            }`}
            title="Ajustes visuales y filtros"
            aria-label="Ajustes visuales y filtros"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        {/* Thumbnail Scrubber Toggle Button */}
        {onToggleScrubber && (
          <button
            data-testid="toggle-scrubber-btn"
            onClick={onToggleScrubber}
            className={`p-2 rounded-xl transition-all border ${
              isScrubberOpen
                ? 'bg-[#dc2626]/20 border-[#dc2626]/60 text-[#dc2626] shadow-[0_0_10px_rgba(220,38,38,0.3)]'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-300 hover:text-white'
            }`}
            title={isScrubberOpen ? 'Ocultar miniaturas' : 'Ver miniaturas del capítulo'}
            aria-label={isScrubberOpen ? 'Ocultar miniaturas' : 'Ver miniaturas del capítulo'}
          >
            <GalleryHorizontal className="w-4 h-4" />
          </button>
        )}

        {/* Quick Chapter Navigation Drawer Button (Sprint 34) */}
        {onToggleChapterNav && (
          <button
            data-testid="toggle-chapter-nav-btn"
            onClick={onToggleChapterNav}
            className={`p-2 rounded-xl transition-all border ${
              isChapterNavOpen
                ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300 shadow-sm'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-300 hover:text-white'
            }`}
            title="Lista de capítulos (C)"
            aria-label="Lista de capítulos"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        )}

        {/* Quick Bookmark Active Page Button (Sprint 34) */}
        {onToggleBookmark && (
          <button
            data-testid="toggle-bookmark-btn"
            onClick={onToggleBookmark}
            className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-amber-400 hover:text-amber-300 transition-colors"
            title="Marcar página actual (B)"
            aria-label="Marcar página actual"
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        )}

        {/* Chapter Switcher & Fullscreen */}
        <button
          disabled={!prevChapterId}
          onClick={() => prevChapterId && onSelectChapter(prevChapterId)}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-800 text-gray-300 hover:text-white transition-colors"
          title="Capítulo Anterior"
          aria-label="Capítulo Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          disabled={!nextChapterId}
          onClick={() => nextChapterId && onSelectChapter(nextChapterId)}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-800 text-gray-300 hover:text-white transition-colors"
          title="Capítulo Siguiente"
          aria-label="Capítulo Siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Zen Immersion Mode Button (Sprint 23) */}
        {onToggleZenMode && (
          <button
            data-testid="zen-mode-btn"
            onClick={onToggleZenMode}
            className={`p-2 rounded-xl transition-all border ${
              isZenMode
                ? 'bg-purple-600/30 text-purple-300 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-400 hover:text-purple-400'
            }`}
            title={isZenMode ? 'Salir de Modo Zen (F)' : 'Modo Zen Inmersivo (Tecla F)'}
            aria-label={isZenMode ? 'Salir de Modo Zen (F)' : 'Modo Zen Inmersivo (Tecla F)'}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors ml-1"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla Completa'}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla Completa'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
