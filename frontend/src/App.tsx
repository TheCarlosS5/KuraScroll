import React, { useState } from 'react';
import { Navbar } from './components/common/Navbar.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { SeriesDetailPage } from './pages/SeriesDetailPage.js';
import { ReaderPage } from './pages/ReaderPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { BackupModal } from './components/settings/BackupModal.js';
import { SisterPlatformModal } from './components/common/SisterPlatformModal.js';
import { StorageTelemetryModal } from './components/settings/StorageTelemetryModal.js';
import { OfflineMutationOutboxHUD } from './components/sync/OfflineMutationOutboxHUD.js';

export function App() {
  const [view, setView] = useState<'catalog' | 'bookmarks' | 'history' | 'detail' | 'reader'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSeriesSlug, setSelectedSeriesSlug] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSisterModalOpen, setIsSisterModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

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
          onOpenBackup={() => setIsBackupOpen(true)}
          onOpenSisterModal={() => setIsSisterModalOpen(true)}
          onOpenStorageTelemetry={() => setIsStorageModalOpen(true)}
        />
      )}

      <main className="flex-1">
        {view === 'catalog' && (
          <CatalogPage
            selectedCategory={selectedCategory}
            onSelectSeries={handleSelectSeries}
            onContinueReading={handleReadChapter}
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

      {/* Backup Import & Export Dialog */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />

      {/* KuraStream Sister Companion Dialog */}
      <SisterPlatformModal
        isOpen={isSisterModalOpen}
        onClose={() => setIsSisterModalOpen(false)}
      />

      {/* 4TB Storage Footprint Telemetry Dialog */}
      <StorageTelemetryModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
      />

      {/* Offline Mutation Outbox & Smart Replay HUD */}
      <OfflineMutationOutboxHUD />
    </div>
  );
}

export default App;
