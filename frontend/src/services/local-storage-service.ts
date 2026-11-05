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

export type SeriesShelfType = 'reading' | 'completed' | 'plan_to_read' | 'dropped' | 'none';

export interface SeriesShelfItem {
  seriesId: string;
  shelf: SeriesShelfType;
  favorite: boolean;
  updatedAt: number;
}

export class LocalStorageService {
  private db: IDBPDatabase | null = null;

  constructor(private dbName = 'kura-scroll-client-db') {}

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(this.dbName, 4, {
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
        if (!db.objectStoreNames.contains('series_shelves')) {
          db.createObjectStore('series_shelves', { keyPath: 'seriesId' });
        }
        if (!db.objectStoreNames.contains('guest_reading_progress')) {
          db.createObjectStore('guest_reading_progress', { keyPath: 'seriesId' });
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

  // --- Isolated Guest Progress Store (IndexedDB) ---
  async saveGuestProgress(progress: LocalReadingProgress): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.put('guest_reading_progress', progress);
  }

  async getGuestProgress(seriesId: string): Promise<LocalReadingProgress | null> {
    await this.init();
    if (!this.db) return null;
    return (await this.db.get('guest_reading_progress', seriesId)) || null;
  }

  async getAllGuestProgress(): Promise<LocalReadingProgress[]> {
    await this.init();
    if (!this.db) return [];
    return await this.db.getAll('guest_reading_progress');
  }

  async deleteGuestProgress(seriesId: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.delete('guest_reading_progress', seriesId);
  }

  async clearGuestProgress(): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.clear('guest_reading_progress');
  }

  async importGuestProgressToAccount(): Promise<{ importedCount: number }> {
    await this.init();
    if (!this.db) return { importedCount: 0 };
    const guestItems = await this.getAllGuestProgress();
    let count = 0;
    for (const item of guestItems) {
      await this.saveProgress(item);
      count++;
    }
    await this.clearGuestProgress();
    return { importedCount: count };
  }

  async clearAccountLocalData(): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.clear('reading_progress');
    await this.db.clear('bookmarks');
    await this.db.clear('sync_queue');
    await this.db.clear('series_shelves');
    // NOTE: Does NOT clear guest_reading_progress, preserving guest state
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

  // Sprint 10.4: User Bookshelf & Collections
  async setSeriesShelf(
    seriesId: string,
    shelf: 'reading' | 'completed' | 'plan_to_read' | 'dropped' | 'none',
    favorite?: boolean
  ): Promise<void> {
    await this.init();
    if (!this.db) return;

    const existing = await this.getSeriesShelf(seriesId);
    const favValue = favorite !== undefined ? favorite : (existing?.favorite ?? false);

    if (shelf === 'none' && !favValue) {
      await this.db.delete('series_shelves', seriesId);
      await this.toggleBookmark(seriesId, false);
    } else {
      await this.db.put('series_shelves', {
        seriesId,
        shelf,
        favorite: favValue,
        updatedAt: Date.now(),
      });
      if (favValue) {
        await this.toggleBookmark(seriesId, true);
      } else if (existing?.favorite) {
        await this.toggleBookmark(seriesId, false);
      }
    }
  }

  async getSeriesShelf(seriesId: string): Promise<{ shelf: string; favorite: boolean } | null> {
    await this.init();
    if (!this.db) return null;
    const item = await this.db.get('series_shelves', seriesId);
    if (!item) return null;
    return {
      shelf: item.shelf,
      favorite: !!item.favorite,
    };
  }

  async getAllShelvedSeries(): Promise<Record<string, { shelf: string; favorite: boolean }>> {
    await this.init();
    if (!this.db) return {};
    const items = await this.db.getAll('series_shelves');
    const record: Record<string, { shelf: string; favorite: boolean }> = {};
    for (const item of items) {
      record[item.seriesId] = {
        shelf: item.shelf,
        favorite: !!item.favorite,
      };
    }
    return record;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const localClientStorage = new LocalStorageService();
