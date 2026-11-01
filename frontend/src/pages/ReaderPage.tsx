import React, { useState, useEffect } from 'react';
import { WebtoonReader } from '../components/reader/WebtoonReader.js';
import { MangaReader } from '../components/reader/MangaReader.js';
import { ReaderControls } from '../components/reader/ReaderControls.js';
import { useReadingProgress } from '../hooks/useReadingProgress.js';

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
    setCurrentPage(page);
    saveProgress(chapterId, page, 0, page === manifest?.pages?.length);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Cargando páginas desde el almacenamiento 4TB...</p>
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

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Floating Header Controls */}
      {showControls && (
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
        />
      )}

      {/* Main Reader Engine */}
      <div
        className="pt-16 pb-12 cursor-default"
        onClick={() => setShowControls((prev) => !prev)}
      >
        {readerMode === 'webtoon' ? (
          <WebtoonReader
            pages={manifest.pages}
            storageBaseUrl={storageBaseUrl}
            onPageVisible={handlePageChange}
          />
        ) : (
          <MangaReader
            pages={manifest.pages}
            currentPage={currentPage}
            mode={readerMode === 'manga-rtl' ? 'RTL' : 'LTR'}
            storageBaseUrl={storageBaseUrl}
            onPageChange={handlePageChange}
            onToggleControls={() => setShowControls((prev) => !prev)}
          />
        )}
      </div>
    </div>
  );
};
