import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ReaderPageItem } from './WebtoonReader.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface MangaReaderProps {
  pages: ReaderPageItem[];
  currentPage: number;
  mode: 'RTL' | 'LTR';
  storageBaseUrl: string;
  onPageChange: (pageNumber: number) => void;
  onToggleControls?: () => void;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  pages,
  currentPage,
  mode,
  storageBaseUrl,
  onPageChange,
  onToggleControls,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const ambientGlowRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<number>(currentPage);
  const isFirstMount = useRef<boolean>(true);

  const totalPages = pages.length;
  const activePage = pages.find((p) => p.pageNumber === currentPage) || pages[0];

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [currentPage, totalPages, mode]);

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

      if (pageWrapperRef.current) {
        gsap.fromTo(
          pageWrapperRef.current,
          { opacity: 0, x: xOffset, scale: 0.99 },
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.35,
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
  }, [currentPage, mode]);

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
      className="relative w-full h-[calc(100vh-60px)] flex items-center justify-center bg-transparent overflow-hidden select-none"
    >
      {/* Soft Ambient Lighting reflecting comic mood behind active page */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-0">
        <img
          ref={ambientGlowRef}
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="w-full max-w-4xl max-h-[85vh] object-contain filter blur-[56px] sm:blur-[72px] saturate-[1.6] opacity-30 select-none pointer-events-none transform-gpu"
        />
        <div className="absolute inset-0 bg-radial from-transparent via-[#080c14]/30 to-[#080c14]/90 pointer-events-none" />
      </div>

      {/* Current Page Display with Zero CLS */}
      <div
        ref={pageWrapperRef}
        style={{ aspectRatio: activePage.aspectRatio > 0 ? activePage.aspectRatio : 0.666 }}
        className="max-h-full max-w-full flex items-center justify-center relative shadow-2xl z-10 transform-gpu"
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

      {/* Page Number Indicator Pill */}
      <div
        ref={pillRef}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#0f172a]/90 backdrop-blur-md border border-white/10 text-xs font-mono text-slate-300 shadow-2xl pointer-events-none flex items-center gap-1.5 z-20"
      >
        <span>
          <span className="text-cyan-400 font-semibold">{currentPage}</span> / {totalPages}
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-slate-400">Modo {mode}</span>
      </div>
    </div>
  );
};
