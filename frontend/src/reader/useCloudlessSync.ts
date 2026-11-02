/**
 * KuraScroll Continuous Reading Session Milestones & Autonomous Cloudless Sync Hook
 * Sprint 85 - CloudlessSync Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, solid #18181b, 0 CLS).
 * Features client-side CRDT vector clock synchronization,
 * milestone achievement triggers, and keyboard shortcut 'Y'.
 */

import { useState, useCallback, useEffect } from 'react';

export type SyncMode = 'local_broadcast' | 'p2p_direct' | 'offline_vault';

export interface UseCloudlessSyncOptions {
  defaultEnabled?: boolean;
  defaultMode?: SyncMode;
  defaultDeviceId?: string;
  defaultChaptersCompleted?: number;
  defaultReadingSeconds?: number;
  defaultStreakDays?: number;
  enableKeyboard?: boolean;
}

export const SYNC_MODE_LABELS: Record<SyncMode, { name: string; description: string }> = {
  local_broadcast: {
    name: 'Baliza Multicast LAN',
    description: 'Sincronización instantánea con dispositivos en la misma red Wi-Fi.',
  },
  p2p_direct: {
    name: 'Emparejamiento Directo P2P',
    description: 'Enlace directo punto a punto con código PIN sin servidor.',
  },
  offline_vault: {
    name: 'Bóveda Aislada (Air-Gapped)',
    description: 'Modo estrictamente local sin actividad de red.',
  },
};

export function useCloudlessSync({
  defaultEnabled = true,
  defaultMode = 'local_broadcast',
  defaultDeviceId = 'local_device',
  defaultChaptersCompleted = 0,
  defaultReadingSeconds = 0,
  defaultStreakDays = 1,
  enableKeyboard = true,
}: UseCloudlessSyncOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [mode, setModeState] = useState<SyncMode>(defaultMode);
  const [localDeviceId, setLocalDeviceIdState] = useState<string>(defaultDeviceId);
  const [activePeerCount, setActivePeerCount] = useState<number>(1);
  const [vectorClock, setVectorClock] = useState<number>(1);
  const [chaptersCompleted, setChaptersCompleted] = useState<number>(defaultChaptersCompleted);
  const [totalReadingSeconds, setTotalReadingSeconds] = useState<number>(defaultReadingSeconds);
  const [streakDays, setStreakDays] = useState<number>(defaultStreakDays);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [milestoneUnlocked, setMilestoneUnlocked] = useState<string | null>(null);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);

  const setMode = useCallback((m: SyncMode) => {
    if (m === 'local_broadcast' || m === 'p2p_direct' || m === 'offline_vault') {
      setModeState(m);
    }
  }, []);

  const setDeviceId = useCallback((id: string) => {
    if (id && id.trim()) {
      setLocalDeviceIdState(id.trim());
    }
  }, []);

  const dismissMilestone = useCallback(() => {
    setMilestoneUnlocked(null);
  }, []);

  const checkMilestone = useCallback((chapters: number) => {
    if (chapters === 10) setMilestoneUnlocked('¡Hito: 10 Capítulos Completados! (Iniciado)');
    else if (chapters === 25) setMilestoneUnlocked('¡Hito: 25 Capítulos Leídos! (Lector Ávido)');
    else if (chapters === 50) setMilestoneUnlocked('¡Hito de Oro: 50 Capítulos! (Maestro Otaku)');
    else if (chapters === 100) setMilestoneUnlocked('¡Hito Legendario: 100 Capítulos Devorados!');
  }, []);

  const recordChapterComplete = useCallback(() => {
    setChaptersCompleted((prev) => {
      const next = prev + 1;
      checkMilestone(next);
      return next;
    });
    setVectorClock((c) => c + 1);
  }, [checkMilestone]);

  const addReadingTime = useCallback((seconds: number) => {
    if (seconds > 0) {
      setTotalReadingSeconds((s) => s + Math.round(seconds));
    }
  }, []);

  /**
   * Reconciles with remote peer state using CRDT join-semilattice logic.
   */
  const reconcileWithPeer = useCallback(
    (remoteState: {
      vectorClock: number;
      chaptersCompleted: number;
      totalReadingSeconds: number;
      streakDays: number;
    }) => {
      if (!isEnabled) return;

      setIsSyncing(true);

      const nextClock = Math.max(vectorClock, remoteState.vectorClock) + 1;
      const nextChapters = Math.max(chaptersCompleted, remoteState.chaptersCompleted);
      const nextSeconds = Math.max(totalReadingSeconds, remoteState.totalReadingSeconds);
      const nextStreak = Math.max(streakDays, remoteState.streakDays);

      setVectorClock(nextClock);
      setChaptersCompleted(nextChapters);
      setTotalReadingSeconds(nextSeconds);
      setStreakDays(nextStreak);
      checkMilestone(nextChapters);

      setTimeout(() => setIsSyncing(false), 300);
    },
    [isEnabled, vectorClock, chaptersCompleted, totalReadingSeconds, streakDays, checkMilestone]
  );

  // Keyboard shortcut 'Y' listener (avoids collision with 'C', 'M', 'K', 'G')
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'y' || e.key === 'Y') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleHUD();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleHUD]);

  return {
    isOpen,
    isEnabled,
    mode,
    localDeviceId,
    activePeerCount,
    vectorClock,
    chaptersCompleted,
    totalReadingSeconds,
    streakDays,
    isSyncing,
    milestoneUnlocked,
    openHUD,
    closeHUD,
    toggleHUD,
    toggleEnabled,
    setMode,
    setDeviceId,
    recordChapterComplete,
    addReadingTime,
    reconcileWithPeer,
    dismissMilestone,
  };
}
