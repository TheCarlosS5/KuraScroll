import React, { useEffect, useRef, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ReaderPageItem } from './WebtoonReader.js';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  BookOpen,
  Keyboard,
  X,
} from 'lucide-react';

export interface MangaReaderProps {
  pages: ReaderPageItem[];
  currentPage: number;
  mode: 'RTL' | 'LTR';
  storageBaseUrl: string;
  onPageChange: (pageNumber: number) => void;
  onToggleControls?: () => void;
  // Sprint 8: Double-page spread and shortcuts HUD
  doublePage?: boolean;
  onToggleDoublePage?: (enabled: boolean) => void;
  showShortcutsHUD?: boolean;
  onToggleShortcutsHUD?: (show: boolean) => void;
  onCycleMode?: () => void;
  onCycleTheme?: () => void;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  pages,
  currentPage,
  mode,
  storageBaseUrl,
  onPageChange,
  onToggleControls,
  doublePage: controlledDoublePage,
  onToggleDoublePage,
  showShortcutsHUD: controlledShowShortcuts,
  onToggleShortcutsHUD,
  onCycleMode,
  onCycleTheme,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const ambientGlowRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<number>(currentPage);
  const isFirstMount = useRef<boolean>(true);

  // Local fallback states if not controlled via props
  const [internalDoublePage, setInternalDoublePage] = useState<boolean>(false);
  const [internalShowShortcuts, setInternalShowShortcuts] = useState<boolean>(false);

  const isDoublePage = controlledDoublePage !== undefined ? controlledDoublePage : internalDoublePage;
  const isHUDOpen = controlledShowShortcuts !== undefined ? controlledShowShortcuts : internalShowShortcuts;

  const handleToggleDoublePage = () => {
    const nextVal = !isDoublePage;
    if (onToggleDoublePage) {
      onToggleDoublePage(nextVal);
    } else {
      setInternalDoublePage(nextVal);
    }
  };

  const handleToggleHUD = () => {
    const nextVal = !isHUDOpen;
    if (onToggleShortcutsHUD) {
      onToggleShortcutsHUD(nextVal);
    } else {
      setInternalShowShortcuts(nextVal);
    }
  };

  const handleCloseHUD = () => {
    if (onToggleShortcutsHUD) {
      onToggleShortcutsHUD(false);
    } else {
      setInternalShowShortcuts(false);
    }
  };

  const totalPages = pages.length;
  const activePage = pages.find((p) => p.pageNumber === currentPage) || pages[0];

  // Intelligent Double-Page Spread detection:
  // 1. Panoramic spreads scanned together (aspectRatio > 1.2) automatically render as a single full spread.
  // 2. When doublePage mode is active, pairs with adjacent page (unless activePage or candidate is wide).
  const isAutoDoubleSpread = useMemo(() => {
    return activePage ? activePage.aspectRatio > 1.2 : false;
  }, [activePage]);

  const secondPage = useMemo(() => {
    if (!isDoublePage || isAutoDoubleSpread || !activePage) return undefined;
    const candidate = pages.find((p) => p.pageNumber === currentPage + 1);
    if (candidate && candidate.aspectRatio <= 1.2) {
      return candidate;
    }
    return undefined;
  }, [isDoublePage, isAutoDoubleSpread, activePage, pages, currentPage]);

  const isShowingTwoPages = secondPage !== undefined;

  // In traditional Japanese Manga (RTL):
  // Facing pages open with current page on the RIGHT and next page on the LEFT.
  // In Western Comic (LTR):
  // Current page is on the LEFT and next page is on the RIGHT.
  const leftPage = mode === 'RTL' ? secondPage : activePage;
  const rightPage = mode === 'RTL' ? activePage : secondPage;

  const handleNext = () => {
    if (isShowingTwoPages) {
      if (currentPage < totalPages - 1) {
        onPageChange(currentPage + 2);
      } else if (currentPage < totalPages) {
        onPageChange(currentPage + 1);
      }
    } else {
      if (currentPage < totalPages) {
        onPageChange(currentPage + 1);
      }
    }
  };

  const handlePrev = () => {
    if (isShowingTwoPages) {
      if (currentPage > 2) {
        onPageChange(currentPage - 2);
      } else if (currentPage > 1) {
        onPageChange(1);
      }
    } else {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle shortcuts modal with '?' or Shift + '/'
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        handleToggleHUD();
        return;
      }

      // Close modal on Escape
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isHUDOpen) {
          e.preventDefault();
          handleCloseHUD();
          return;
        }
      }

      // Toggle fullscreen with 'f' / 'F'
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }

      // Cycle mode with 'm' / 'M'
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onCycleMode?.();
        return;
      }

      // Cycle theme with 't' / 'T'
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        onCycleTheme?.();
        return;
      }

      // Page turn navigation
      if (mode === 'RTL') {
        // Japanese manga standard: reading right-to-left
        if (e.key === 'ArrowLeft' || e.code === 'KeyD') {
          handleNext();
        } else if (e.key === 'ArrowRight' || e.code === 'KeyA') {
          handlePrev();
        }
      } else {
        // Western LTR standard
        if (e.key === 'ArrowRight' || e.code === 'KeyD') {
          handleNext();
        } else if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
          handlePrev();
        }
      }

      if (e.key === ' ' || e.code === 'Space') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, totalPages, mode, isHUDOpen, isShowingTwoPages, onCycleMode, onCycleTheme]);

  // GSAP animations for page slide/fade & soft ambient lighting
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;

        if (pageWrapperRef.current) {
          gsap.fromTo(
            pageWrapperRef.current,
            { opacity: 0, scale: 0.98 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.45,
              ease: 'power3.out',
              clearProps: 'transform',
            }
          );
        }

        if (ambientGlowRef.current) {
          gsap.fromTo(
            ambientGlowRef.current,
            { opacity: 0, scale: 1.05 },
            {
              opacity: 0.32,
              scale: 1.15,
              duration: 0.7,
              ease: 'power2.out',
            }
          );
        }

        if (pillRef.current) {
          gsap.fromTo(
            pillRef.current,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.4,
              ease: 'back.out(1.4)',
            }
          );
        }
        return;
      }

      const isAdvancing = currentPage > prevPageRef.current;
      // Japanese Manga RTL: advancing enters from left (-35px); retreating enters from right (35px)
      // Western LTR: advancing enters from right (35px); retreating enters from left (-35px)
      const slideDistance = 35;
      const xOffset =
        mode === 'RTL'
          ? isAdvancing
            ? -slideDistance
            : slideDistance
          : isAdvancing
          ? slideDistance
          : -slideDistance;

      const tiltAngle =
        mode === 'RTL'
          ? isAdvancing
            ? -2.5
            : 2.5
          : isAdvancing
          ? 2.5
          : -2.5;

      if (pageWrapperRef.current) {
        gsap.fromTo(
          pageWrapperRef.current,
          {
            opacity: 0,
            x: xOffset,
            rotateY: tiltAngle,
            scale: 0.99,
          },
          {
            opacity: 1,
            x: 0,
            rotateY: 0,
            scale: 1,
            duration: 0.38,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      }

      if (ambientGlowRef.current) {
        gsap.fromTo(
          ambientGlowRef.current,
          { opacity: 0.08, scale: 1.05 },
          {
            opacity: 0.32,
            scale: 1.15,
            duration: 0.65,
            ease: 'power2.out',
          }
        );
      }

      if (pillRef.current) {
        gsap.fromTo(
          pillRef.current,
          { scale: 0.92 },
          {
            scale: 1,
            duration: 0.28,
            ease: 'back.out(1.4)',
          }
        );
      }
    }, containerRef);

    prevPageRef.current = currentPage;

    return () => ctx.revert();
  }, [currentPage, mode, isShowingTwoPages]);

  // GSAP animation for Shortcuts HUD Modal entrance
  useEffect(() => {
    if (isHUDOpen && hudRef.current) {
      gsap.fromTo(
        hudRef.current,
        { opacity: 0, scale: 0.94, y: -12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power3.out' }
      );
    }
  }, [isHUDOpen]);

  if (!activePage) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-sm">
        No hay páginas disponibles
      </div>
    );
  }

  const imageUrl = `${storageBaseUrl}/${activePage.fileName}`;

  return (
    <div
      ref={containerRef}
      style={{ perspective: '1200px' }}
      className="relative w-full h-[calc(100vh-60px)] flex items-center justify-center bg-[#080c14] overflow-hidden select-none"
    >
      {/* Soft Ambient Lighting reflecting comic mood behind active page / spread */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-0">
        <img
          ref={ambientGlowRef}
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className={`w-full ${isShowingTwoPages ? 'max-w-6xl' : 'max-w-4xl'} max-h-[85vh] object-contain filter blur-[56px] sm:blur-[72px] saturate-[1.6] opacity-30 select-none pointer-events-none transform-gpu`}
        />
        <div className="absolute inset-0 bg-radial from-transparent via-[#080c14]/30 to-[#080c14]/90 pointer-events-none" />
      </div>

      {/* Current Page or Double-Page Spread Display with Zero CLS */}
      <div
        ref={pageWrapperRef}
        style={{ transformStyle: 'preserve-3d' }}
        className="max-h-full max-w-full flex items-center justify-center relative shadow-2xl z-10 transform-gpu"
        data-testid="manga-spread-container"
      >
        {isShowingTwoPages ? (
          /* Facing Double-Page Spread (Lado a lado enfrentadas) */
          <div className="flex flex-row items-center justify-center gap-1.5 max-h-full max-w-full">
            {/* Left Page (Page N+1 in RTL, Page N in LTR) */}
            <div
              data-testid={`spread-page-${leftPage!.pageNumber}`}
              style={{ aspectRatio: leftPage!.aspectRatio > 0 ? leftPage!.aspectRatio : 0.666 }}
              className="max-h-[calc(100vh-80px)] flex items-center justify-center relative shadow-2xl overflow-hidden rounded-sm"
            >
              <div className="absolute inset-0 bg-[#0f172a]/70 rounded-md border border-white/5 flex items-center justify-center pointer-events-none">
                <span className="text-slate-600 font-mono text-xs select-none tracking-widest">
                  PÁGINA {leftPage!.pageNumber}
                </span>
              </div>
              <img
                src={`${storageBaseUrl}/${leftPage!.fileName}`}
                alt={`Página ${leftPage!.pageNumber}`}
                className="max-h-full max-w-full object-contain relative z-10 rounded-sm shadow-xl block"
              />
            </div>

            {/* Right Page (Page N in RTL, Page N+1 in LTR) */}
            <div
              data-testid={`spread-page-${rightPage!.pageNumber}`}
              style={{ aspectRatio: rightPage!.aspectRatio > 0 ? rightPage!.aspectRatio : 0.666 }}
              className="max-h-[calc(100vh-80px)] flex items-center justify-center relative shadow-2xl overflow-hidden rounded-sm"
            >
              <div className="absolute inset-0 bg-[#0f172a]/70 rounded-md border border-white/5 flex items-center justify-center pointer-events-none">
                <span className="text-slate-600 font-mono text-xs select-none tracking-widest">
                  PÁGINA {rightPage!.pageNumber}
                </span>
              </div>
              <img
                src={`${storageBaseUrl}/${rightPage!.fileName}`}
                alt={`Página ${rightPage!.pageNumber}`}
                className="max-h-full max-w-full object-contain relative z-10 rounded-sm shadow-xl block"
              />
            </div>
          </div>
        ) : (
          /* Single Page or Auto-detected Panoramic Double-Spread */
          <div
            style={{ aspectRatio: activePage.aspectRatio > 0 ? activePage.aspectRatio : 0.666 }}
            className="max-h-full max-w-full flex items-center justify-center relative shadow-2xl"
            data-testid={`single-page-${activePage.pageNumber}`}
          >
            {/* Zero CLS Skeleton Placeholder */}
            <div className="absolute inset-0 bg-[#0f172a]/70 rounded-md border border-white/5 flex items-center justify-center pointer-events-none">
              <span className="text-slate-600 font-mono text-xs select-none tracking-widest">
                PÁGINA {activePage.pageNumber}
              </span>
            </div>

            <img
              src={imageUrl}
              alt={`Página ${activePage.pageNumber}`}
              className="max-h-full max-w-full object-contain relative z-10 rounded-sm shadow-2xl block"
            />
          </div>
        )}
      </div>

      {/* Tap Zones for Touch/Mouse Navigation */}
      {/* Left Tap Zone */}
      <div
        onClick={() => (mode === 'RTL' ? handleNext() : handlePrev())}
        className="absolute top-0 left-0 w-1/4 h-full cursor-pointer hover:bg-white/[0.02] transition-colors flex items-center justify-start pl-4 group z-20"
        title={mode === 'RTL' ? 'Página Siguiente' : 'Página Anterior'}
      >
        <div className="p-3 rounded-full bg-[#0f172a]/80 backdrop-blur-md text-slate-400 group-hover:text-cyan-400 group-hover:bg-[#1e293b]/90 group-hover:scale-110 border border-white/10 transition-all shadow-xl opacity-0 group-hover:opacity-100">
          <ChevronLeft className="w-6 h-6" />
        </div>
      </div>

      {/* Center Tap Zone (Toggle UI Controls) */}
      <div
        onClick={onToggleControls}
        className="absolute top-0 left-1/4 w-2/4 h-full cursor-pointer z-20"
        title="Alternar controles"
      />

      {/* Right Tap Zone */}
      <div
        onClick={() => (mode === 'RTL' ? handlePrev() : handleNext())}
        className="absolute top-0 right-0 w-1/4 h-full cursor-pointer hover:bg-white/[0.02] transition-colors flex items-center justify-end pr-4 group z-20"
        title={mode === 'RTL' ? 'Página Anterior' : 'Página Siguiente'}
      >
        <div className="p-3 rounded-full bg-[#0f172a]/80 backdrop-blur-md text-slate-400 group-hover:text-cyan-400 group-hover:bg-[#1e293b]/90 group-hover:scale-110 border border-white/10 transition-all shadow-xl opacity-0 group-hover:opacity-100">
          <ChevronRight className="w-6 h-6" />
        </div>
      </div>

      {/* Page Number Indicator Pill & Ergonomic Quick Toggles */}
      <div
        ref={pillRef}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#0f172a]/90 backdrop-blur-md border border-white/10 text-xs font-mono text-slate-300 shadow-2xl flex items-center gap-2 z-20"
      >
        <span>
          <span className="text-cyan-400 font-semibold">
            {isShowingTwoPages ? `${currentPage}-${secondPage!.pageNumber}` : currentPage}
          </span>
          <span className="text-slate-500"> / </span>
          <span>{totalPages}</span>
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-slate-400">
          {isAutoDoubleSpread
            ? 'Panorámica'
            : isShowingTwoPages
            ? `Doble (${mode})`
            : `Modo ${mode}`}
        </span>

        <div className="h-3 w-px bg-slate-700/80 mx-0.5" />

        {/* Double-page toggle in pill */}
        <button
          data-testid="pill-toggle-double-page"
          onClick={handleToggleDoublePage}
          className={`p-1 rounded-md transition-colors ${
            isDoublePage
              ? 'text-cyan-400 hover:text-cyan-300 bg-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title={isDoublePage ? 'Desactivar doble página' : 'Activar doble página (Spread)'}
          aria-label="Alternar doble página"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        {/* Shortcuts HUD trigger button in pill */}
        <button
          data-testid="pill-open-shortcuts"
          onClick={handleToggleHUD}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Atajos de teclado (?)"
          aria-label="Atajos de teclado"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Keyboard Shortcuts HUD Modal */}
      {isHUDOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Atajos de teclado"
          data-testid="shortcuts-hud-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity"
          onClick={handleCloseHUD}
        >
          <div
            ref={hudRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#0f172a]/95 border border-white/10 rounded-2xl p-6 shadow-2xl text-white transform-gpu relative"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">Atajos de Teclado</h3>
                  <p className="text-xs text-slate-400">Navegación rápida y controles ergonómicos</p>
                </div>
              </div>
              <button
                data-testid="close-hud-btn"
                onClick={handleCloseHUD}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shortcuts Guide */}
            <div className="space-y-2.5 font-sans text-sm">
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Avanzar página</span>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                    {mode === 'RTL' ? '←' : '→'}
                  </kbd>
                  <span className="text-xs text-slate-500">o</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                    D
                  </kbd>
                  <span className="text-xs text-slate-500">o</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                    Espacio
                  </kbd>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Retroceder página</span>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                    {mode === 'RTL' ? '→' : '←'}
                  </kbd>
                  <span className="text-xs text-slate-500">o</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                    A
                  </kbd>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Pantalla completa</span>
                <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                  F
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Alternar modo Manga / Webtoon</span>
                <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                  M
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Alternar tema de fondo</span>
                <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                  T
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Doble página (Spread enfrentadas)</span>
                <span className="text-xs text-cyan-400/90 font-mono">Auto en panorámicas / Toggle</span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Abrir / Cerrar este menú</span>
                <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                  ?
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                <span className="text-slate-300">Salir / Cerrar modal</span>
                <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                  Esc
                </kbd>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-slate-400">
              <span>Presiona <kbd className="px-1.5 py-0.5 font-mono text-cyan-400 bg-slate-800 border border-slate-700 rounded">?</kbd> para consultar atajos</span>
              <button
                onClick={handleCloseHUD}
                className="px-3.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-medium transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
