import { useEffect, useRef } from 'react';
import { localClientStorage, LocalReadingProgress } from '../services/local-storage-service.js';
import { syncCoordinator } from '../services/sync-coordinator.js';

export function useReadingProgress(seriesId: string, accountUserId?: string) {
  const syncTimer = useRef<NodeJS.Timeout | null>(null);

  const saveProgress = async (
    chapterId: string,
    pageNumber: number,
    scrollOffsetY = 0,
    isCompleted = false
  ) => {
    // Keep guest reading offline-first. Signed-in users store history per account on the server.
    if (!accountUserId) {
      const progress: LocalReadingProgress = {
        seriesId,
        chapterId,
        pageNumber,
        scrollOffsetY,
        timestamp: Date.now(),
      };
      await localClientStorage.saveProgress(progress);
    }

    // 2. Debounced background sync to backend
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }

    syncTimer.current = setTimeout(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!accountUserId) {
          await syncCoordinator.enqueue('UPDATE_PROGRESS', {
            seriesId,
            chapterId,
            pageNumber,
            scrollOffsetY,
            isCompleted,
          });
        }
        return;
      }

      try {
        const res = await fetch('/api/v1/progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'KuraScrollSPA',
          },
          credentials: 'include',
          body: JSON.stringify({
            userId: 'local_user',
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
        if (!accountUserId) {
          await syncCoordinator.enqueue('UPDATE_PROGRESS', {
            seriesId,
            chapterId,
            pageNumber,
            scrollOffsetY,
            isCompleted,
          });
        }
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
