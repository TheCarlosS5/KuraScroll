import React, { useState, useEffect } from 'react';
import { BookOpen, Bookmark, Sparkles, History, Database, Film, Flame, Trophy, BarChart2 } from 'lucide-react';
import { OfflineSyncHUD } from './OfflineSyncHUD.js';
import { BatterySaverHUD } from './BatterySaverHUD.js';
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

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
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

  const fetchBadges = async () => {
    try {
      const res = await fetch('/api/v1/badges?userId=local_user');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        if (data.badges) setBadgesList(data.badges);
        if (data.summary) setBadgeSummary(data.summary);
      }

      // Check for unnotified badges to trigger celebration toast
      const unnotifiedRes = await fetch('/api/v1/badges/unnotified?userId=local_user');
      if (unnotifiedRes.ok) {
        const unnotifiedData = await unnotifiedRes.json();
        if (unnotifiedData?.unnotified?.length > 0) {
          const firstUnlocked = unnotifiedData.unnotified[0];
          setUnlockToastBadge(firstUnlocked);
          // Mark as notified
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
    } catch {
      // Offline fallback
    }
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
    } catch {
      // Offline fallback
    }
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
    } catch {
      // Offline fallback
    }
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
      } catch {
        // Offline mode fallback
      }
    }
    fetchStreak();
    fetchGoalsAndProgress();
    fetchBadges();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[#080c14]/90 backdrop-blur-md border-b border-gray-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & KS Monogram */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onNavigate?.('catalog')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] group-hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all">
            KS
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                KuraScroll
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 border border-violet-700/50">
                Sister to KS
              </span>
            </div>
            <p className="text-[11px] text-gray-400 -mt-0.5">Manga • Manhwa • Manhua</p>
          </div>
        </div>

        {/* Category Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-gray-900/60 p-1 rounded-xl border border-gray-800/60">
          <button
            onClick={() => onNavigate?.('catalog', '')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'catalog' && !selectedCategory
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manga')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'manga'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manga
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manhwa')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'manhwa'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manhwa
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manhua')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'manhua'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manhua
          </button>
        </nav>

        {/* Bookmarks, History & Storage Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Reading Streak Flame Badge */}
          {streakDays > 0 && (
            <div
              data-testid="nav-streak-badge"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                isStreakActiveToday
                  ? 'bg-orange-950/70 border-orange-600/60 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.25)]'
                  : 'bg-gray-900/80 border-gray-800 text-gray-400'
              }`}
              style={{ contain: 'layout paint' }}
              title={`Racha de lectura activa: ${streakDays} días consecutivos`}
            >
              <Flame className={`w-3.5 h-3.5 ${isStreakActiveToday ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-gray-500'}`} />
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
              size={34}
              strokeWidth={3}
              onClick={() => setIsGoalModalOpen(true)}
            />
          </div>

          {/* Hardware Battery Saver Indicator */}
          <BatterySaverHUD />

          {/* Offline Sync Diagnostics HUD */}
          <OfflineSyncHUD />

          <button
            data-testid="nav-history-btn"
            onClick={() => onNavigate?.('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              currentView === 'history'
                ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-gray-700 hover:text-white'
            }`}
            title="Historial de lectura"
            aria-label="Historial de lectura"
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          <button
            onClick={() => onNavigate?.('bookmarks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              currentView === 'bookmarks'
                ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                : 'bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-gray-700 hover:text-white'
            }`}
          >
            <Bookmark className="w-4 h-4 text-violet-400" />
            <span className="hidden sm:inline">Guardados</span>
          </button>

          <button
            data-testid="nav-badges-btn"
            onClick={() => setIsBadgeModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-amber-500/50 hover:text-amber-400"
            title="Logros y Medallas de Lectura"
            aria-label="Logros y Medallas de Lectura"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Logros</span>
          </button>

          <button
            data-testid="nav-stats-btn"
            onClick={() => setIsStatsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-cyan-500/50 hover:text-cyan-400"
            title="Estadísticas Otaku (Radar & Heatmap)"
            aria-label="Estadísticas Otaku"
          >
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Stats</span>
          </button>

          {onOpenBackup && (
            <button
              data-testid="nav-backup-btn"
              onClick={onOpenBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-cyan-500/50 hover:text-cyan-400"
              title="Copias de Seguridad y Migración"
              aria-label="Copias de Seguridad y Migración"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Respaldos</span>
            </button>
          )}

          {onOpenSisterModal && (
            <button
              data-testid="nav-sister-btn"
              onClick={onOpenSisterModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-purple-500/50 hover:text-purple-400"
              title="Ecosistema Hermano KuraStream"
              aria-label="Ecosistema Hermano KuraStream"
            >
              <Film className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">KuraStream</span>
            </button>
          )}

          <button
            data-testid="nav-storage-telemetry-btn"
            onClick={onOpenStorageTelemetry}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-950/80 border border-cyan-500/20 hover:border-cyan-500/60 text-xs text-gray-300 hover:text-cyan-400 transition-all cursor-pointer"
            title="Ver telemetría y eficiencia del HDD 4TB"
            aria-label="Ver telemetría del HDD 4TB"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>4TB Local Host</span>
          </button>
        </div>
      </div>

      {/* Daily Goal Customizer Modal */}
      <DailyGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        initialGoal={goalData}
        todayProgress={todayProgress}
        calendar={calendar}
        lifetime={lifetime}
        onSaveGoal={handleSaveGoal}
      />

      {/* Badges and Achievements Grid Modal */}
      <BadgeGridModal
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
        badges={badgesList}
        summary={badgeSummary}
      />

      {/* Real-time Badge Unlock Celebration Toast */}
      <BadgeUnlockToast
        badge={unlockToastBadge}
        onDismiss={() => setUnlockToastBadge(null)}
      />

      {/* Otaku Stats Modal (Radar & Heatmap) */}
      <OtakuStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />
    </header>
  );
};
