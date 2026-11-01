import React from 'react';
import { ArrowLeft, Maximize2, Minimize2, ChevronLeft, ChevronRight, LayoutList, Layers } from 'lucide-react';

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
}) => {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-[#080c14]/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between text-white transition-all shadow-xl">
      {/* Left: Back & Titles */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white transition-colors border border-gray-800"
          title="Volver a la serie"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-gray-200 line-clamp-1">{seriesTitle}</h2>
          <p className="text-xs text-cyan-400 font-medium">
            Capítulo {chapterNumber} {chapterTitle ? `• ${chapterTitle}` : ''}
          </p>
        </div>
      </div>

      {/* Middle: Reader Mode Toggle Buttons */}
      <div className="hidden sm:flex items-center gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800">
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
      </div>

      {/* Right: Chapter Switcher & Fullscreen */}
      <div className="flex items-center gap-2">
        <button
          disabled={!prevChapterId}
          onClick={() => prevChapterId && onSelectChapter(prevChapterId)}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-800 text-gray-300 hover:text-white transition-colors"
          title="Capítulo Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          disabled={!nextChapterId}
          onClick={() => nextChapterId && onSelectChapter(nextChapterId)}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-800 text-gray-300 hover:text-white transition-colors"
          title="Capítulo Siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors ml-1"
          title="Pantalla Completa"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
