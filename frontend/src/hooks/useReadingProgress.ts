import { useEffect, useRef } from 'react';
import { localClientStorage, LocalReadingProgress } from '../services/local-storage-service.js';

export function useReadingProgress(seriesId: string) {
  const syncTimer = useRef<NodeJS.Timeout | null>(null);

  const saveProgress = async (
    chapterId: string,
    pageNumber: number,
    scrollOffsetY = 0,
    isCompleted = false
  ) => {
    // 1. Instant offline save to IndexedDB
    const progress: LocalReadingProgress = {
      seriesId,
      chapterId,
      pageNumber,
      scrollOffsetY,
      timestamp: Date.now(),
    };
    await localClientStorage.saveProgress(progress);

    // 2. Debounced background sync to backend
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }

    syncTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/v1/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'local_user',
            seriesId,
            chapterId,
            pageNumber,
            scrollOffsetY,
            isCompleted,
          }),
        });
      } catch {
        // Offline or backend unreachable, IndexedDB holds truth
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
