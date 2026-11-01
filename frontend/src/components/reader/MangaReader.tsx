import React, { useEffect } from 'react';
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

  if (!activePage) {
    return <div className="p-8 text-center text-gray-500">No hay páginas disponibles</div>;
  }

  const imageUrl = `${storageBaseUrl}/${activePage.fileName}`;

  return (
    <div className="relative w-full h-[calc(100vh-60px)] flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Current Page Display */}
      <div
        style={{ aspectRatio: activePage.aspectRatio > 0 ? activePage.aspectRatio : 0.666 }}
        className="max-h-full max-w-full flex items-center justify-center relative shadow-2xl"
      >
        <img
          src={imageUrl}
          alt={`Página ${activePage.pageNumber}`}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      {/* Tap Zones for Touch/Mouse Navigation */}
      {/* Left Tap Zone */}
      <div
        onClick={() => (mode === 'RTL' ? handleNext() : handlePrev())}
        className="absolute top-0 left-0 w-1/4 h-full cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-start pl-4 group"
      >
        <div className="p-2 rounded-full bg-black/40 text-gray-400 group-hover:text-white group-hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100">
          <ChevronLeft className="w-6 h-6" />
        </div>
      </div>

      {/* Center Tap Zone (Toggle UI Controls) */}
      <div
        onClick={onToggleControls}
        className="absolute top-0 left-1/4 w-2/4 h-full cursor-pointer"
      />

      {/* Right Tap Zone */}
      <div
        onClick={() => (mode === 'RTL' ? handlePrev() : handleNext())}
        className="absolute top-0 right-0 w-1/4 h-full cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-end pr-4 group"
      >
        <div className="p-2 rounded-full bg-black/40 text-gray-400 group-hover:text-white group-hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100">
          <ChevronRight className="w-6 h-6" />
        </div>
      </div>

      {/* Page Number Indicator Pill */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gray-950/80 backdrop-blur-md border border-gray-800 text-xs text-gray-300 pointer-events-none">
        {currentPage} / {totalPages} • Modo {mode}
      </div>
    </div>
  );
};
