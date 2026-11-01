import React, { useState } from 'react';
import { Navbar } from './components/common/Navbar.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { SeriesDetailPage } from './pages/SeriesDetailPage.js';
import { ReaderPage } from './pages/ReaderPage.js';
import { HistoryPage } from './pages/HistoryPage.js';

export function App() {
  const [view, setView] = useState<'catalog' | 'bookmarks' | 'history' | 'detail' | 'reader'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSeriesSlug, setSelectedSeriesSlug] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const handleNavigate = (newView: string, category?: string) => {
    setSelectedCategory(category);
    if (newView === 'bookmarks') {
      setView('bookmarks');
    } else if (newView === 'history') {
      setView('history');
    } else {
      setView('catalog');
    }
  };

  const handleSelectSeries = (slug: string) => {
    setSelectedSeriesSlug(slug);
    setView('detail');
  };

  const handleReadChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setView('reader');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col">
      {/* Show Navbar on all views except full reader */}
      {view !== 'reader' && (
        <Navbar
          currentView={view}
          selectedCategory={selectedCategory}
          onNavigate={handleNavigate}
        />
      )}

      <main className="flex-1">
        {view === 'catalog' && (
          <CatalogPage
            selectedCategory={selectedCategory}
            onSelectSeries={handleSelectSeries}
          />
        )}

        {view === 'bookmarks' && (
          <CatalogPage
            isBookmarksView={true}
            onSelectSeries={handleSelectSeries}
          />
        )}

        {view === 'history' && (
          <HistoryPage
            onSelectSeries={handleSelectSeries}
            onContinueReading={handleReadChapter}
            onExploreCatalog={() => setView('catalog')}
          />
        )}

        {view === 'detail' && selectedSeriesSlug && (
          <SeriesDetailPage
            slug={selectedSeriesSlug}
            onBack={() => setView('catalog')}
            onReadChapter={handleReadChapter}
          />
        )}

        {view === 'reader' && selectedChapterId && (
          <ReaderPage
            chapterId={selectedChapterId}
            onBack={() => setView('detail')}
            onSelectChapter={(nextId) => setSelectedChapterId(nextId)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
