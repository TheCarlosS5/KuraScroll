import { useEffect, useRef } from 'react';
import { localClientStorage, LocalReadingProgress } from '../services/local-storage-service.js';
import { syncCoordinator } from '../services/sync-coordinator.js';

export function useReadingProgress(seriesId: string) {
  const syncTimer = useRef<NodeJS.Timeout | null>(null);

  const saveProgress = async (
    chapterId: string,
    pageNumber: number,
    scrollOffsetY = 0,
    isCompleted = false
  ) => {
    const isGuest = typeof localStorage !== 'undefined' && localStorage.getItem('kura_guest_mode') === 'true';

    // 1. Instant offline save to IndexedDB (guest store vs account store)
    const progress: LocalReadingProgress = {
      seriesId,
      chapterId,
      pageNumber,
      scrollOffsetY,
      timestamp: Date.now(),
    };

    if (isGuest) {
      await localClientStorage.saveGuestProgress(progress);
      // In guest mode, do not sync to backend
      return;
    }

    await localClientStorage.saveProgress(progress);

    // 2. Debounced background sync to backend for authenticated users
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }

    syncTimer.current = setTimeout(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await syncCoordinator.enqueue('UPDATE_PROGRESS', {
          seriesId,
          chapterId,
          pageNumber,
          scrollOffsetY,
          isCompleted,
        });
        return;
      }

      try {
        const res = await fetch('/api/v1/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            seriesId,
            chapterId,
            pageNumber,
            scrollOffsetY,
            isCompleted,
          }),
        });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
      } catch {
        // Network failure, safely enqueue into Outbox for batch replay
        await syncCoordinator.enqueue('UPDATE_PROGRESS', {
          seriesId,
          chapterId,
          pageNumber,
          scrollOffsetY,
          isCompleted,
        });
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
    };
  }, []);

  return { saveProgress };
}
