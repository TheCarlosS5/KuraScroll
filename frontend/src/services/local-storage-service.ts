import { openDB, IDBPDatabase } from 'idb';

export interface LocalReadingProgress {
  seriesId: string;
  chapterId: string;
  pageNumber: number;
  scrollOffsetY: number;
  timestamp: number;
}

export interface SyncQueueItem extends LocalReadingProgress {
  isCompleted?: boolean;
  queuedAt: number;
}

export class LocalStorageService {
  private db: IDBPDatabase | null = null;

  constructor(private dbName = 'kura-scroll-client-db') {}

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(this.dbName, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('reading_progress')) {
          db.createObjectStore('reading_progress', { keyPath: 'seriesId' });
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'seriesId' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'seriesId' });
        }
      },
    });
  }

  async saveProgress(progress: LocalReadingProgress): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.put('reading_progress', progress);
  }

  async getProgress(seriesId: string): Promise<LocalReadingProgress | null> {
    await this.init();
    if (!this.db) return null;
    return (await this.db.get('reading_progress', seriesId)) || null;
  }

  async getAllProgress(): Promise<LocalReadingProgress[]> {
    await this.init();
    if (!this.db) return [];
    return await this.db.getAll('reading_progress');
  }

  async deleteProgress(seriesId: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.delete('reading_progress', seriesId);
  }

  async clearAllProgress(): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.clear('reading_progress');
  }

  async enqueueSync(item: SyncQueueItem): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.put('sync_queue', item);
  }

  async getPendingSync(): Promise<SyncQueueItem[]> {
    await this.init();
    if (!this.db) return [];
    return await this.db.getAll('sync_queue');
  }

  async dequeueSync(seriesId: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.delete('sync_queue', seriesId);
  }

  async clearSyncQueue(): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.clear('sync_queue');
  }

  async toggleBookmark(seriesId: string, isBookmarked: boolean): Promise<void> {
    await this.init();
    if (!this.db) return;
    if (isBookmarked) {
      await this.db.put('bookmarks', { seriesId, createdAt: Date.now() });
    } else {
      await this.db.delete('bookmarks', seriesId);
    }
  }

  async getBookmarks(): Promise<string[]> {
    await this.init();
    if (!this.db) return [];
    const rows = await this.db.getAll('bookmarks');
    return rows.map((r: any) => r.seriesId);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const localClientStorage = new LocalStorageService();
