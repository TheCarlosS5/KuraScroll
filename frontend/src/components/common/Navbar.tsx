import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Bookmark,
  History,
  Database,
  Film,
  Flame,
  Trophy,
  BarChart2,
  MoreHorizontal,
  HardDrive,
  Target,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { DailyGoalRing } from '../habits/DailyGoalRing.js';
import {
  DailyGoalModal,
  DailyGoalData,
  TodayProgressData,
  CalendarDayData,
  LifetimeStatsData,
} from '../habits/DailyGoalModal.js';
import { BadgeGridModal, UserBadgeItem, BadgeSummaryData } from '../habits/BadgeGridModal.js';
import { BadgeUnlockToast } from '../habits/BadgeUnlockToast.js';
import { OtakuStatsModal } from '../stats/OtakuStatsModal.js';

export interface NavbarProps {
  currentView?: string;
  selectedCategory?: string;
  onNavigate?: (view: string, category?: string) => void;
  onOpenBackup?: () => void;
  onOpenSisterModal?: () => void;
  onOpenStorageTelemetry?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'catalog',
  selectedCategory,
  onNavigate,
  onOpenBackup,
  onOpenSisterModal,
  onOpenStorageTelemetry,
}) => {
  const [streakDays, setStreakDays] = useState<number>(0);
  const [isStreakActiveToday, setIsStreakActiveToday] = useState<boolean>(false);

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(() => {
    try {
      return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('goal');
    } catch {
      return false;
    }
  });
  const [goalData, setGoalData] = useState<DailyGoalData>({
    targetType: 'pages',
    targetValue: 30,
    notificationsEnabled: true,
  });
  const [todayProgress, setTodayProgress] = useState<TodayProgressData>({
    pagesRead: 0,
    readingSeconds: 0,
    goalCompleted: false,
    progressPercentage: 0,
  });
  const [calendar, setCalendar] = useState<CalendarDayData[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeStatsData>({
    lifetimePages: 0,
    lifetimeSeconds: 0,
    totalGoalsCompleted: 0,
    currentStreak: 0,
    bestStreak: 0,
  });

  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [badgesList, setBadgesList] = useState<UserBadgeItem[]>([]);
  const [badgeSummary, setBadgeSummary] = useState<BadgeSummaryData>({
    total: 12,
    unlocked: 0,
    inProgress: 0,
    percentage: 0,
  });
  const [unlockToastBadge, setUnlockToastBadge] = useState<UserBadgeItem | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  // Clean popover menu state
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBadges = async () => {
    try {
      const res = await fetch('/api/v1/badges?userId=local_user');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        if (data.badges) setBadgesList(data.badges);
        if (data.summary) setBadgeSummary(data.summary);
      }

      const unnotifiedRes = await fetch('/api/v1/badges/unnotified?userId=local_user');
      if (unnotifiedRes.ok) {
        const unnotifiedData = await unnotifiedRes.json();
        if (unnotifiedData?.unnotified?.length > 0) {
          const firstUnlocked = unnotifiedData.unnotified[0];
          setUnlockToastBadge(firstUnlocked);
          fetch('/api/v1/badges/notified', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: 'local_user',
              badgeIds: [firstUnlocked.id],
            }),
          }).catch(() => {});
        }
      }
    } catch {}
  };

  const fetchGoalsAndProgress = async () => {
    try {
      const res = await fetch('/api/v1/analytics/goals?userId=local_user');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        if (data.goal) setGoalData(data.goal);
        if (data.today) setTodayProgress(data.today);
        if (data.calendar) setCalendar(data.calendar);
        if (data.lifetime) setLifetime(data.lifetime);
      }
    } catch {}
  };

  const handleSaveGoal = async (newGoal: DailyGoalData) => {
    try {
      const res = await fetch('/api/v1/analytics/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'local_user', ...newGoal }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.goal) setGoalData(data.goal);
        if (data?.today) setTodayProgress(data.today);
      }
    } catch {}
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchStreak() {
      try {
        const res = await fetch('/api/v1/analytics/streak?userId=local_user');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.streak) {
          setStreakDays(data.streak.currentStreak || 0);
          setIsStreakActiveToday(Boolean(data.streak.isStreakActiveToday));
        }
      } catch {}
    }
    fetchStreak();
    fetchGoalsAndProgress();
    fetchBadges();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#090d16]/95 backdrop-blur-md border-b border-white/[0.06] transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & KS Monogram */}
        <div
          className="flex items-center gap-2 cursor-pointer select-none group shrink-0"
          onClick={() => onNavigate?.('catalog')}
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-sm group-hover:bg-indigo-500 transition-colors">
            KS
          </div>
          <span className="font-semibold text-base text-zinc-100 tracking-tight group-hover:text-white transition-colors">
            KuraScroll
          </span>
        </div>

        {/* Category Navigation (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80">
          <button
            onClick={() => onNavigate?.('catalog', '')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              currentView === 'catalog' && !selectedCategory
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manga')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedCategory === 'manga'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manga
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manhwa')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedCategory === 'manhwa'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manhwa
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manhua')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedCategory === 'manhua'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manhua
          </button>
        </nav>

        {/* Right Section: Core Navigation + Overflow Tools */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Reading Streak Indicator */}
          {streakDays > 0 && (
            <div
              data-testid="nav-streak-badge"
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${
                isStreakActiveToday
                  ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
              }`}
              title={`Racha: ${streakDays} días consecutivos`}
            >
              <Flame className={`w-3.5 h-3.5 ${isStreakActiveToday ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'}`} />
              <span>{streakDays}d</span>
            </div>
          )}

          {/* Daily Goal Ring Trigger */}
          <div data-testid="nav-daily-goal-ring" className="flex items-center">
            <DailyGoalRing
              current={
                goalData.targetType === 'pages'
                  ? todayProgress.pagesRead
                  : Math.round(todayProgress.readingSeconds / 60)
              }
              target={goalData.targetValue}
              unit={goalData.targetType === 'pages' ? 'pág' : 'min'}
              size={26}
              strokeWidth={2.5}
              onClick={() => setIsGoalModalOpen(true)}
            />
          </div>

          {/* Primary View Switchers: Historial & Guardados */}
          <button
            data-testid="nav-history-btn"
            onClick={() => onNavigate?.('history')}
            className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'history'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80'
            }`}
            title="Historial de lectura"
            aria-label="Historial de lectura"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          <button
            onClick={() => onNavigate?.('bookmarks')}
            className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'bookmarks'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80'
            }`}
            title="Mangas guardados"
          >
            <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Guardados</span>
          </button>

          {/* Secondary Tools Menu (More Popover) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 transition-colors border border-transparent hover:border-zinc-800"
              title="Más herramientas y opciones"
              aria-label="Opciones"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown Menu - always in DOM for accessibility & test stability, hidden via CSS */}
            <div
              className={`absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1 z-50 text-xs transition-all ${
                isMoreMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none hidden'
              }`}
            >
              <button
                data-testid="nav-badges-btn"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsBadgeModalOpen(true);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Logros</span>
              </button>

              <button
                data-testid="nav-stats-btn"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsStatsModalOpen(true);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
              >
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <span>Estadísticas de Lectura</span>
              </button>

              {onOpenBackup && (
                <button
                  data-testid="nav-backup-btn"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenBackup();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
                >
                  <Database className="w-4 h-4 text-zinc-400" />
                  <span>Respaldos</span>
                </button>
              )}

              {onOpenSisterModal && (
                <button
                  data-testid="nav-sister-btn"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenSisterModal();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
                >
                  <Film className="w-4 h-4 text-violet-400" />
                  <span>KuraStream</span>
                </button>
              )}

              {onOpenStorageTelemetry && (
                <button
                  data-testid="nav-storage-telemetry-btn"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenStorageTelemetry();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
                >
                  <HardDrive className="w-4 h-4 text-zinc-400" />
                  <span>4TB Local Host</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Categories Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
            aria-label="Abrir menú"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-2.5 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              onNavigate?.('catalog', '');
              setIsMobileMenuOpen(false);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              currentView === 'catalog' && !selectedCategory
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => {
              onNavigate?.('catalog', 'manga');
              setIsMobileMenuOpen(false);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              selectedCategory === 'manga'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400'
            }`}
          >
            Manga
          </button>
          <button
            onClick={() => {
              onNavigate?.('catalog', 'manhwa');
              setIsMobileMenuOpen(false);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              selectedCategory === 'manhwa'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400'
            }`}
          >
            Manhwa
          </button>
          <button
            onClick={() => {
              onNavigate?.('catalog', 'manhua');
              setIsMobileMenuOpen(false);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              selectedCategory === 'manhua'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400'
            }`}
          >
            Manhua
          </button>
        </div>
      )}
      </header>

      {/* Modals placed outside of <header> to prevent backdrop-filter containing block trap */}
      <DailyGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        initialGoal={goalData}
        todayProgress={todayProgress}
        calendar={calendar}
        lifetime={lifetime}
        onSaveGoal={handleSaveGoal}
      />

      <BadgeGridModal
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
        badges={badgesList}
        summary={badgeSummary}
      />

      <BadgeUnlockToast
        badge={unlockToastBadge}
        onDismiss={() => setUnlockToastBadge(null)}
      />

      <OtakuStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />
    </>
  );
};
