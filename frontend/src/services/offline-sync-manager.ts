import { LocalStorageService, LocalReadingProgress, SyncQueueItem, localClientStorage } from './local-storage-service.js';

export interface SyncOptions {
  userId?: string;
  fetchFn?: typeof fetch;
}

export interface SyncStats {
  synced: number;
  failed: number;
  errors: string[];
}

export class OfflineSyncManager {
  constructor(
    private storage: LocalStorageService = localClientStorage,
    private apiBaseUrl: string = ''
  ) {}

  async recordProgress(
    progress: LocalReadingProgress,
    isCompleted = false,
    options: SyncOptions = {}
  ): Promise<void> {
    // 1. Instantly save progress to local IndexedDB (zero latency / offline first)
    await this.storage.saveProgress(progress);

    // 2. Enqueue in persistent sync queue
    const queueItem: SyncQueueItem = {
      ...progress,
      isCompleted,
      queuedAt: Date.now(),
    };
    await this.storage.enqueueSync(queueItem);

    // 3. Opportunistically attempt background push if online
    const fetchImpl = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
    if (fetchImpl) {
      try {
        const res = await fetchImpl(`${this.apiBaseUrl}/api/v1/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: options.userId ?? 'local_user',
            seriesId: progress.seriesId,
            chapterId: progress.chapterId,
            pageNumber: progress.pageNumber,
            scrollOffsetY: progress.scrollOffsetY,
            isCompleted,
          }),
        });

        if (res.ok) {
          // Dequeue once confirmed by backend
          await this.storage.dequeueSync(progress.seriesId);
        }
      } catch {
        // Offline or server unreachable: queue preserves record safely in IndexedDB
      }
    }
  }

  async syncAllPending(options: SyncOptions = {}): Promise<SyncStats> {
    const pending = await this.storage.getPendingSync();
    const stats: SyncStats = { synced: 0, failed: 0, errors: [] };
    const fetchImpl = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);

    if (!fetchImpl || pending.length === 0) {
      return stats;
    }

    for (const item of pending) {
      try {
        const res = await fetchImpl(`${this.apiBaseUrl}/api/v1/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: options.userId ?? 'local_user',
            seriesId: item.seriesId,
            chapterId: item.chapterId,
            pageNumber: item.pageNumber,
            scrollOffsetY: item.scrollOffsetY,
            isCompleted: item.isCompleted,
          }),
        });

        if (res.ok) {
          await this.storage.dequeueSync(item.seriesId);
          stats.synced++;
        } else {
          stats.failed++;
          stats.errors.push(`Server returned ${res.status} for ${item.seriesId}`);
        }
      } catch (err: any) {
        stats.failed++;
        stats.errors.push(err.message || 'Network error');
      }
    }

    return stats;
  }

  async resolveBidirectional(
    seriesId: string,
    options: SyncOptions = {}
  ): Promise<{ resolved: 'local' | 'remote' | 'equal'; progress: LocalReadingProgress | null }> {
    const local = await this.storage.getProgress(seriesId);
    const fetchImpl = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
    const userId = options.userId ?? 'local_user';

    if (!fetchImpl) {
      return { resolved: 'local', progress: local };
    }

    try {
      const res = await fetchImpl(`${this.apiBaseUrl}/api/v1/progress/${seriesId}?userId=${userId}`);
      if (!res.ok) {
        return { resolved: 'local', progress: local };
      }

      const remote = await res.json();
      if (!remote || !remote.chapterId) {
        // Remote has no progress; local wins if present
        if (local) {
          await this.recordProgress(local, false, options);
        }
        return { resolved: 'local', progress: local };
      }

      const remotePage = remote.pageNumber ?? 1;
      const localPage = local?.pageNumber ?? 0;

      if (remotePage > localPage) {
        // Remote is further ahead: update local IndexedDB
        const updatedLocal: LocalReadingProgress = {
          seriesId,
          chapterId: remote.chapterId,
          pageNumber: remote.pageNumber,
          scrollOffsetY: remote.scrollOffsetY ?? 0,
          timestamp: Date.now(),
        };
        await this.storage.saveProgress(updatedLocal);
        return { resolved: 'remote', progress: updatedLocal };
      } else if (localPage > remotePage) {
        // Local is ahead: push local to server
        if (local) {
          await this.recordProgress(local, Boolean(remote.isCompleted), options);
        }
        return { resolved: 'local', progress: local };
      } else {
        return { resolved: 'equal', progress: local };
      }
    } catch {
      return { resolved: 'local', progress: local };
    }
  }

  async getPendingCount(): Promise<number> {
    const pending = await this.storage.getPendingSync();
    return pending.length;
  }
}

export const offlineSyncManager = new OfflineSyncManager();
