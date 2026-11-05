import React, { useState } from 'react';
import { Navbar } from './components/common/Navbar.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { SeriesDetailPage } from './pages/SeriesDetailPage.js';
import { ReaderPage } from './pages/ReaderPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { PublishMangaPage } from './pages/PublishMangaPage.js';
import { AddChapterPage } from './pages/AddChapterPage.js';
import { ModerationPanel } from './components/moderation/ModerationPanel.js';
import { UserAuthHUD } from './components/common/UserAuthHUD.js';
import { useAuth } from './hooks/useAuth.js';
import { BackupModal } from './components/settings/BackupModal.js';
import { SisterPlatformModal } from './components/common/SisterPlatformModal.js';
import { StorageTelemetryModal } from './components/settings/StorageTelemetryModal.js';
import { OfflineMutationOutboxHUD } from './components/sync/OfflineMutationOutboxHUD.js';

export interface AuthReturnTarget {
  view: 'catalog' | 'bookmarks' | 'history' | 'detail' | 'reader' | 'profile' | 'publish' | 'publishChapter' | 'moderation';
  slug?: string | null;
  chapterId?: string | null;
  pageNumber?: number;
  seriesId?: string | null;
  seriesTitle?: string;
  userHandle?: string | null;
}

export function App() {
  const { user, loading: authLoading, login, register, logout, verifyEmail, resendCode, refreshUser } = useAuth();

  const [view, setView] = useState<
    'catalog' | 'bookmarks' | 'history' | 'detail' | 'reader' | 'login' | 'register' | 'profile' | 'publish' | 'publishChapter' | 'moderation'
  >(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('chapter')) return 'reader';
      if (params.has('series')) return 'detail';
      if (params.has('view')) {
        const v = params.get('view');
        if (v === 'login' || v === 'register' || v === 'profile' || v === 'publish') return v;
      }
    } catch {}
    return 'catalog';
  });
  const [returnTarget, setReturnTarget] = useState<AuthReturnTarget | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSeriesSlug, setSelectedSeriesSlug] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('series');
    } catch {
      return null;
    }
  });
  const [selectedUserHandle, setSelectedUserHandle] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('user');
    } catch {
      return null;
    }
  });
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('chapter');
    } catch {
      return null;
    }
  });
  const [selectedPageNumber, setSelectedPageNumber] = useState<number>(() => {
    try {
      const page = Number.parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10);
      return Number.isSafeInteger(page) && page > 0 ? page : 1;
    } catch {
      return 1;
    }
  });
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [selectedSeriesTitle, setSelectedSeriesTitle] = useState('');
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSisterModalOpen, setIsSisterModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

  const navigateToAuth = (authView: 'login' | 'register', customTarget?: AuthReturnTarget) => {
    if (view !== 'login' && view !== 'register') {
      const target: AuthReturnTarget = customTarget || {
        view,
        slug: selectedSeriesSlug,
        chapterId: selectedChapterId,
        pageNumber: selectedPageNumber,
        seriesId: selectedSeriesId,
        seriesTitle: selectedSeriesTitle,
        userHandle: selectedUserHandle,
      };
      setReturnTarget(target);
    }
    setView(authView);
  };

  const handleAuthSuccess = () => {
    if (returnTarget) {
      const dest = returnTarget;
      setReturnTarget(null);
      if (dest.slug) setSelectedSeriesSlug(dest.slug);
      if (dest.chapterId) setSelectedChapterId(dest.chapterId);
      if (dest.pageNumber) setSelectedPageNumber(dest.pageNumber);
      if (dest.seriesId) setSelectedSeriesId(dest.seriesId);
      if (dest.seriesTitle) setSelectedSeriesTitle(dest.seriesTitle);
      if (dest.userHandle) setSelectedUserHandle(dest.userHandle);
      setView(dest.view);
    } else {
      setView('catalog');
    }
  };

  const handleAuthBack = () => {
    if (returnTarget) {
      const dest = returnTarget;
      setReturnTarget(null);
      setView(dest.view);
    } else {
      setView('catalog');
    }
  };

  const handleNavigate = (newView: string, category?: string) => {
    setSelectedCategory(category);
    if (newView === 'bookmarks') {
      setView('bookmarks');
    } else if (newView === 'history') {
      setView('history');
    } else if (newView === 'login') {
      navigateToAuth('login');
    } else if (newView === 'register') {
      navigateToAuth('register');
    } else if (newView === 'publish') {
      setView('publish');
    } else {
      setView('catalog');
    }
  };

  const handleSelectSeries = (slug: string) => {
    setSelectedSeriesSlug(slug);
    setView('detail');
  };

  const handleReadChapter = (chapterId: string, seriesSlug?: string, pageNumber?: number) => {
    setSelectedChapterId(chapterId);
    if (seriesSlug) setSelectedSeriesSlug(seriesSlug);
    setSelectedPageNumber(Number.isSafeInteger(pageNumber) && pageNumber! > 0 ? pageNumber! : 1);
    setView('reader');
  };

  const handleOpenProfile = (handle: string) => {
    setSelectedUserHandle(handle);
    setView('profile');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 flex flex-col antialiased overflow-x-hidden w-full max-w-full">
      {/* Community Status Bar with Authentication HUD */}
      {view !== 'reader' && (
        <div className="w-full bg-[#0b101d] border-b border-gray-800/80 px-4 sm:px-8 py-2 flex items-center justify-between z-30">
          <div
            onClick={() => setView('catalog')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 group-hover:animate-ping"></div>
            <span className="text-xs font-semibold text-gray-300 group-hover:text-cyan-400 transition-colors">
              KuraScroll Cloud
            </span>
          </div>

          <UserAuthHUD
            user={user}
            onNavigate={(navView, handle) => {
              if (navView === 'profile' && handle) {
                handleOpenProfile(handle);
              } else if (navView === 'publish') {
                setView('publish');
              } else if (navView === 'login') {
                navigateToAuth('login');
              } else if (navView === 'register') {
                navigateToAuth('register');
              } else if (navView === 'moderation') {
                setView('moderation');
              }
            }}
            onLogout={logout}
          />
        </div>
      )}

      {/* Show Navbar on all views except full reader */}
      {view !== 'reader' && (
        <Navbar
          currentView={view as any}
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
            currentUser={user}
            authLoading={authLoading}
            onSelectSeries={handleSelectSeries}
            onContinueReading={handleReadChapter}
            onExploreCatalog={() => setView('catalog')}
          />
        )}

        {view === 'detail' && selectedSeriesSlug && (
          <SeriesDetailPage
            key={`${selectedSeriesSlug}-${detailRefreshKey}`}
            slug={selectedSeriesSlug}
            currentUser={user}
            onBack={() => setView('catalog')}
            onReadChapter={handleReadChapter}
            onAddChapter={(seriesId, title) => {
              setSelectedSeriesId(seriesId);
              setSelectedSeriesTitle(title);
              setView('publishChapter');
            }}
            onRequireAuth={() => navigateToAuth('login', { view: 'detail', slug: selectedSeriesSlug })}
          />
        )}

        {view === 'login' && (
          <LoginPage
            onSuccess={handleAuthSuccess}
            onNavigateRegister={() => setView('register')}
            onBack={handleAuthBack}
            onSkip={() => setView('catalog')}
            onLogin={login}
            onVerifyEmail={verifyEmail}
            onResendCode={resendCode}
          />
        )}

        {view === 'register' && (
          <RegisterPage
            onSuccess={handleAuthSuccess}
            onNavigateLogin={() => setView('login')}
            onBack={handleAuthBack}
            onSkip={() => setView('catalog')}
            onRegister={register}
            onVerifyEmail={verifyEmail}
            onResendCode={resendCode}
          />
        )}

        {view === 'profile' && (selectedUserHandle || user?.handle) && (
          <ProfilePage
            handle={selectedUserHandle || user!.handle}
            currentUser={user}
            onBack={() => setView('catalog')}
            onSelectSeries={handleSelectSeries}
            onUserUpdated={refreshUser}
          />
        )}

        {view === 'publish' && (
          <PublishMangaPage
            onBack={() => setView('catalog')}
            onSuccess={(newSlug) => {
              setSelectedSeriesSlug(newSlug);
              setDetailRefreshKey((k) => k + 1);
              setView('detail');
            }}
          />
        )}

        {view === 'publishChapter' && selectedSeriesId && (
          <AddChapterPage
            seriesId={selectedSeriesId}
            seriesTitle={selectedSeriesTitle}
            onBack={() => setView('detail')}
            onSuccess={() => {
              setDetailRefreshKey((k) => k + 1);
              setView('detail');
            }}
          />
        )}

        {view === 'moderation' && (
          <ModerationPanel onBack={() => setView('catalog')} />
        )}

        {view === 'reader' && selectedChapterId && (
          <ReaderPage
            chapterId={selectedChapterId}
            initialPageNumber={selectedPageNumber}
            onBack={() => setView('detail')}
            onSelectChapter={(nextId, pageNumber) => {
              setSelectedChapterId(nextId);
              setSelectedPageNumber(pageNumber ?? 1);
            }}
            currentUser={user}
            onRequireAuth={(pageNumber) => navigateToAuth('login', {
              view: 'reader',
              chapterId: selectedChapterId,
              slug: selectedSeriesSlug,
              pageNumber: pageNumber ?? selectedPageNumber,
            })}
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
