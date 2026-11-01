import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { LocalStorageService, LocalReadingProgress } from '../../frontend/src/services/local-storage-service';
import { OfflineSyncManager } from '../../frontend/src/services/offline-sync-manager';
import { buildApp } from '../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database';
import { SeriesRepository } from '../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../src/backend/repositories/chapter-repository';

describe('Senior QA & Resilience Suite: Offline IndexedDB Sync & Multi-Tab Concurrency (E2E)', () => {
  const testSandbox = path.resolve(__dirname, 'sandbox-offline-sync');
  const storageRoot = path.join(testSandbox, 'storage');
  let db: DatabaseInstance;
  let app: any;
  let seriesRepo: SeriesRepository;
  let chapRepo: ChapterRepository;

  beforeAll(async () => {
    await fs.mkdir(testSandbox, { recursive: true });
    await fs.mkdir(storageRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    app = buildApp({ db, storageRoot });
    await app.ready();

    seriesRepo = new SeriesRepository(db);
    chapRepo = new ChapterRepository(db);

    // Seed test series and chapters for reading progress
    seriesRepo.createSeries({
      id: 'solo-leveling',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa',
      status: 'completed',
    });

    chapRepo.createChapter({
      id: 'sl-c1',
      seriesId: 'solo-leveling',
      chapterNumber: 1,
      title: 'Chapter 1',
      storagePath: 'series/solo-leveling/v1/c1',
    });

    chapRepo.createChapter({
      id: 'sl-c2',
      seriesId: 'solo-leveling',
      chapterNumber: 2,
      title: 'Chapter 2',
      storagePath: 'series/solo-leveling/v1/c2',
    });

    seriesRepo.createSeries({
      id: 'tower-of-god',
      slug: 'tower-of-god',
      titlePrimary: 'Tower of God',
      type: 'manhwa',
      status: 'ongoing',
    });

    chapRepo.createChapter({
      id: 'tog-c1',
      seriesId: 'tower-of-god',
      chapterNumber: 1,
      title: 'Floor of Tests',
      storagePath: 'series/tower-of-god/v1/c1',
    });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // =========================================================================
  // 1. Network Loss / Backend Server Failure: Uninterrupted Offline Reading
  // =========================================================================
  describe('1. Network Outage & Server Downtime Resilience', () => {
    it('1.1: reader saves rapid progress to IndexedDB locally when backend is completely offline', async () => {
      const dbName = `test-offline-client-${Date.now()}-1`;
      const clientStorage = new LocalStorageService(dbName);
      const syncManager = new OfflineSyncManager(clientStorage);

      // Simulated network failure fetch implementation (throws network error)
      const offlineFetch = async () => {
        throw new TypeError('Failed to fetch: net::ERR_CONNECTION_REFUSED');
      };

      // User reads through pages 1 to 25 during network blackout
      const pageProgression = [1, 5, 10, 18, 25];

      for (const page of pageProgression) {
        const progress: LocalReadingProgress = {
          seriesId: 'solo-leveling',
          chapterId: 'sl-c1',
          pageNumber: page,
          scrollOffsetY: page * 250,
          timestamp: Date.now(),
        };

        // Must NOT throw; user interface remains smooth and responsive
        await expect(
          syncManager.recordProgress(progress, false, { fetchFn: offlineFetch as any })
        ).resolves.not.toThrow();
      }

      // Verify that IndexedDB preserved the latest progress
      const localProgress = await clientStorage.getProgress('solo-leveling');
      expect(localProgress).not.toBeNull();
      expect(localProgress?.pageNumber).toBe(25);
      expect(localProgress?.chapterId).toBe('sl-c1');
      expect(localProgress?.scrollOffsetY).toBe(25 * 250);

      // Verify sync queue holds the pending update
      const pendingCount = await syncManager.getPendingCount();
      expect(pendingCount).toBe(1);

      // Verify backend database has NO records yet (still zero writes to server)
      const count = db.prepare('SELECT COUNT(*) as c FROM user_progress WHERE series_id = ?').get('solo-leveling') as any;
      expect(count.c).toBe(0);

      await clientStorage.close();
    });

    it('1.2: keeps pending sync queue intact across multiple reader restarts during outage', async () => {
      const dbName = `test-offline-restart-${Date.now()}`;

      // Session 1: reading offline
      const storage1 = new LocalStorageService(dbName);
      const sync1 = new OfflineSyncManager(storage1);

      await sync1.recordProgress(
        {
          seriesId: 'tower-of-god',
          chapterId: 'tog-c1',
          pageNumber: 15,
          scrollOffsetY: 1200,
          timestamp: Date.now(),
        },
        false,
        { fetchFn: async () => { throw new Error('Offline'); } }
      );
      await storage1.close();

      // Session 2: user reopens app while still offline
      const storage2 = new LocalStorageService(dbName);
      const sync2 = new OfflineSyncManager(storage2);

      const recovered = await storage2.getProgress('tower-of-god');
      expect(recovered).not.toBeNull();
      expect(recovered?.pageNumber).toBe(15);

      const pending = await sync2.getPendingCount();
      expect(pending).toBe(1);

      await storage2.close();
    });
  });

  // =========================================================================
  // 2. Reconnection Recovery: Zero Duplicate Rows & Zero Lost Progress
  // =========================================================================
  describe('2. Reconnection Recovery & Bidirectional Sync', () => {
    it('2.1: syncs offline accumulated changes to backend without duplicate rows', async () => {
      const dbName = `test-reconnect-${Date.now()}`;
      const clientStorage = new LocalStorageService(dbName);
      const syncManager = new OfflineSyncManager(clientStorage);

      // 1. User records progress on multiple series while offline
      await syncManager.recordProgress(
        {
          seriesId: 'solo-leveling',
          chapterId: 'sl-c1',
          pageNumber: 42,
          scrollOffsetY: 850,
          timestamp: Date.now(),
        },
        false,
        { fetchFn: async () => { throw new Error('No connection'); } }
      );

      await syncManager.recordProgress(
        {
          seriesId: 'tower-of-god',
          chapterId: 'tog-c1',
          pageNumber: 30,
          scrollOffsetY: 400,
          timestamp: Date.now(),
        },
        true,
        { fetchFn: async () => { throw new Error('No connection'); } }
      );

      expect(await syncManager.getPendingCount()).toBe(2);

      // 2. Network reconnects: server inject mock
      const onlineFetch = async (url: string, init?: any) => {
        const parsedUrl = new URL(url, 'http://localhost');
        const res = await app.inject({
          method: (init?.method || 'GET') as any,
          url: parsedUrl.pathname + parsedUrl.search,
          headers: init?.headers,
          payload: init?.body,
        });

        return {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => res.json(),
        };
      };

      // 3. Trigger reconciliation
      const syncStats = await syncManager.syncAllPending({ fetchFn: onlineFetch as any });
      expect(syncStats.synced).toBe(2);
      expect(syncStats.failed).toBe(0);

      // 4. Verify pending queue was emptied upon successful confirmation
      expect(await syncManager.getPendingCount()).toBe(0);

      // 5. Verify backend database state: zero duplicates, accurate values
      const slRow = db.prepare('SELECT * FROM user_progress WHERE series_id = ?').get('solo-leveling') as any;
      expect(slRow).toBeDefined();
      expect(slRow.page_number).toBe(42);
      expect(slRow.chapter_id).toBe('sl-c1');
      expect(slRow.scroll_offset_y).toBe(850);
      expect(slRow.is_completed).toBe(0);

      const togRow = db.prepare('SELECT * FROM user_progress WHERE series_id = ?').get('tower-of-god') as any;
      expect(togRow).toBeDefined();
      expect(togRow.page_number).toBe(30);
      expect(togRow.is_completed).toBe(1);

      // Total records in DB must be exactly 2 (no duplicates!)
      const totalCount = db.prepare('SELECT COUNT(*) as c FROM user_progress').get() as any;
      expect(totalCount.c).toBe(2);

      await clientStorage.close();
    });

    it('2.2: bidirectional sync: pulls newer remote progress if server is ahead', async () => {
      const dbName = `test-bidi-sync-${Date.now()}`;
      const clientStorage = new LocalStorageService(dbName);
      const syncManager = new OfflineSyncManager(clientStorage);

      // Seed server with progress from Device B (e.g. tablet reading page 50)
      db.prepare(`
        INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at)
        VALUES ('local_user', 'solo-leveling', 'sl-c2', 50, 100, 0, datetime('now'))
      `).run();

      // Device A locally only read up to page 10
      await clientStorage.saveProgress({
        seriesId: 'solo-leveling',
        chapterId: 'sl-c1',
        pageNumber: 10,
        scrollOffsetY: 50,
        timestamp: Date.now() - 3600000,
      });

      const onlineFetch = async (url: string, init?: any) => {
        const parsedUrl = new URL(url, 'http://localhost');
        const res = await app.inject({
          method: (init?.method || 'GET') as any,
          url: parsedUrl.pathname + parsedUrl.search,
          headers: init?.headers,
          payload: init?.body,
        });

        return {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => res.json(),
        };
      };

      // Resolve bidirectional: server has page 50, local has page 10 => server wins
      const resolution = await syncManager.resolveBidirectional('solo-leveling', {
        fetchFn: onlineFetch as any,
      });

      expect(resolution.resolved).toBe('remote');
      expect(resolution.progress?.pageNumber).toBe(50);
      expect(resolution.progress?.chapterId).toBe('sl-c2');

      // Local storage must now reflect the newer remote progress
      const local = await clientStorage.getProgress('solo-leveling');
      expect(local?.pageNumber).toBe(50);
      expect(local?.chapterId).toBe('sl-c2');

      await clientStorage.close();
    });
  });

  // =========================================================================
  // 3. Multi-Tab Client Concurrency on Shared IndexedDB Database
  // =========================================================================
  describe('3. Multi-Tab Client Concurrency & Lock-Free Storage', () => {
    it('3.1: multiple concurrent tabs writing to the same IndexedDB database do not deadlock or abort', async () => {
      const sharedDbName = `multi-tab-db-${Date.now()}`;

      // Simulate 3 browser tabs open simultaneously
      const tab1 = new LocalStorageService(sharedDbName);
      const tab2 = new LocalStorageService(sharedDbName);
      const tab3 = new LocalStorageService(sharedDbName);

      // Tab 1, 2, and 3 perform concurrent writes
      const writeOperations = [
        tab1.saveProgress({
          seriesId: 'solo-leveling',
          chapterId: 'sl-c1',
          pageNumber: 10,
          scrollOffsetY: 100,
          timestamp: Date.now(),
        }),
        tab2.saveProgress({
          seriesId: 'tower-of-god',
          chapterId: 'tog-c1',
          pageNumber: 20,
          scrollOffsetY: 200,
          timestamp: Date.now(),
        }),
        tab3.saveProgress({
          seriesId: 'solo-leveling',
          chapterId: 'sl-c1',
          pageNumber: 15,
          scrollOffsetY: 150,
          timestamp: Date.now() + 10, // Latest timestamp
        }),
        tab1.toggleBookmark('solo-leveling', true),
        tab2.toggleBookmark('tower-of-god', true),
      ];

      // All concurrent promises must settle successfully without AbortError or VersionError
      await expect(Promise.all(writeOperations)).resolves.not.toThrow();

      // Verify data integrity across tabs
      const slFromTab2 = await tab2.getProgress('solo-leveling');
      expect(slFromTab2?.pageNumber).toBe(15);

      const togFromTab1 = await tab1.getProgress('tower-of-god');
      expect(togFromTab1?.pageNumber).toBe(20);

      const bookmarksFromTab3 = await tab3.getBookmarks();
      expect(bookmarksFromTab3).toContain('solo-leveling');
      expect(bookmarksFromTab3).toContain('tower-of-god');

      await tab1.close();
      await tab2.close();
      await tab3.close();
    });

    it('3.2: simultaneous sync flush from multiple tabs to Fastify SQLite WAL executes without lock contention', async () => {
      const sharedDbName = `multi-tab-sync-${Date.now()}`;

      const tabA = new LocalStorageService(sharedDbName);
      const tabB = new LocalStorageService(sharedDbName);

      const syncA = new OfflineSyncManager(tabA);
      const syncB = new OfflineSyncManager(tabB);

      // Tab A updates Chapter 1
      await syncA.recordProgress(
        {
          seriesId: 'solo-leveling',
          chapterId: 'sl-c1',
          pageNumber: 8,
          scrollOffsetY: 200,
          timestamp: Date.now(),
        },
        false,
        { fetchFn: async () => { throw new Error('Simulated offline'); } }
      );

      // Tab B updates Chapter 2
      await syncB.recordProgress(
        {
          seriesId: 'solo-leveling',
          chapterId: 'sl-c2',
          pageNumber: 12,
          scrollOffsetY: 400,
          timestamp: Date.now() + 50,
        },
        false,
        { fetchFn: async () => { throw new Error('Simulated offline'); } }
      );

      const onlineFetch = async (url: string, init?: any) => {
        const parsedUrl = new URL(url, 'http://localhost');
        const res = await app.inject({
          method: (init?.method || 'GET') as any,
          url: parsedUrl.pathname + parsedUrl.search,
          headers: init?.headers,
          payload: init?.body,
        });

        return {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => res.json(),
        };
      };

      // Both tabs come online and trigger sync simultaneously
      const [resA, resB] = await Promise.all([
        syncA.syncAllPending({ fetchFn: onlineFetch as any }),
        syncB.syncAllPending({ fetchFn: onlineFetch as any }),
      ]);

      // At least one tab synced the latest record
      expect(resA.synced + resB.synced).toBeGreaterThanOrEqual(1);

      // Verify database has exactly 1 row for this series
      const rows = db.prepare('SELECT * FROM user_progress WHERE series_id = ?').all('solo-leveling') as any[];
      expect(rows.length).toBe(1);
      // The final state corresponds to chapter 2
      expect(rows[0].chapter_id).toBe('sl-c2');
      expect(rows[0].page_number).toBe(12);

      await tabA.close();
      await tabB.close();
    });
  });
});
