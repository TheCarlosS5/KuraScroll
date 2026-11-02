import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  StorageVaultService,
  VaultChapterRecord,
  QuotaPolicyRecord,
  DEFAULT_QUOTA_POLICY,
} from '../../../../src/backend/services/storage-vault-service.js';

describe('StorageVaultService Unit Tests (Sprint 72)', () => {
  let db: DatabaseInstance;
  let service: StorageVaultService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new StorageVaultService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Weighted Eviction Score & Candidate Sorting', () => {
    it('grants total immunity (-Infinity) to pinned chapters', () => {
      const chapter: VaultChapterRecord = {
        userId: 'u1',
        seriesId: 's1',
        chapterId: 'c1',
        chapterNumber: 1,
        seriesTitle: 'Solo Leveling',
        totalBytes: 50 * 1024 * 1024,
        totalPages: 40,
        isPinned: true,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: Date.now() - 30 * 86400000, // 30 days ago
        downloadedAt: Date.now() - 30 * 86400000,
      };

      const score = StorageVaultService.calculateEvictionScore(chapter, Date.now());
      expect(score).toBe(-Infinity);
    });

    it('grants total immunity (-Infinity) to currently active chapter', () => {
      const chapter: VaultChapterRecord = {
        userId: 'u1',
        seriesId: 's1',
        chapterId: 'c-active',
        chapterNumber: 5,
        seriesTitle: 'Solo Leveling',
        totalBytes: 80 * 1024 * 1024,
        totalPages: 60,
        isPinned: false,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: Date.now() - 86400000,
        downloadedAt: Date.now() - 86400000,
      };

      const score = StorageVaultService.calculateEvictionScore(chapter, Date.now(), 'c-active');
      expect(score).toBe(-Infinity);
    });

    it('ranks older read chapters higher for eviction than newer unread or favorites', () => {
      const now = Date.now();
      const chOldRead: VaultChapterRecord = {
        userId: 'u1',
        seriesId: 's1',
        chapterId: 'c-old-read',
        chapterNumber: 1,
        seriesTitle: 'Manga A',
        totalBytes: 50 * 1024 * 1024,
        totalPages: 30,
        isPinned: false,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: now - 7 * 86400000, // 7 days ago
        downloadedAt: now - 7 * 86400000,
      };

      const chUnread: VaultChapterRecord = {
        userId: 'u1',
        seriesId: 's1',
        chapterId: 'c-unread',
        chapterNumber: 2,
        seriesTitle: 'Manga A',
        totalBytes: 50 * 1024 * 1024,
        totalPages: 30,
        isPinned: false,
        isUnread: true,
        isFavorite: false,
        lastAccessedAt: now - 7 * 86400000,
        downloadedAt: now - 7 * 86400000,
      };

      const chFav: VaultChapterRecord = {
        userId: 'u1',
        seriesId: 's1',
        chapterId: 'c-fav',
        chapterNumber: 3,
        seriesTitle: 'Manga A',
        totalBytes: 50 * 1024 * 1024,
        totalPages: 30,
        isPinned: false,
        isUnread: false,
        isFavorite: true,
        lastAccessedAt: now - 7 * 86400000,
        downloadedAt: now - 7 * 86400000,
      };

      const scoreOldRead = StorageVaultService.calculateEvictionScore(chOldRead, now);
      const scoreUnread = StorageVaultService.calculateEvictionScore(chUnread, now);
      const scoreFav = StorageVaultService.calculateEvictionScore(chFav, now);

      expect(scoreOldRead).toBeGreaterThan(scoreUnread);
      expect(scoreUnread).toBeGreaterThan(scoreFav);

      const sorted = StorageVaultService.sortCandidates([chFav, chOldRead, chUnread], now);
      expect(sorted[0].chapterId).toBe('c-old-read');
      expect(sorted[1].chapterId).toBe('c-unread');
      expect(sorted[2].chapterId).toBe('c-fav');
    });
  });

  describe('Inventory Management & CRUD', () => {
    it('registers chapters and retrieves user inventory correctly', () => {
      const now = Date.now();
      service.registerDownloadedChapter({
        userId: 'user_1',
        seriesId: 'series_one',
        chapterId: 'chap_1',
        chapterNumber: 1,
        seriesTitle: 'Tower of God',
        totalBytes: 25 * 1024 * 1024,
        totalPages: 28,
        isPinned: false,
        isUnread: true,
        isFavorite: false,
        lastAccessedAt: now,
        downloadedAt: now,
      });

      const inv = service.getVaultInventory('user_1');
      expect(inv).toHaveLength(1);
      expect(inv[0].chapterId).toBe('chap_1');
      expect(inv[0].seriesTitle).toBe('Tower of God');
      expect(inv[0].totalBytes).toBe(25 * 1024 * 1024);
      expect(inv[0].isPinned).toBe(false);
      expect(inv[0].isUnread).toBe(true);
    });

    it('toggles pin status on an offline chapter', () => {
      const now = Date.now();
      service.registerDownloadedChapter({
        userId: 'user_1',
        seriesId: 'series_one',
        chapterId: 'chap_1',
        chapterNumber: 1,
        seriesTitle: 'Tower of God',
        totalBytes: 20 * 1024 * 1024,
        totalPages: 25,
        isPinned: false,
        isUnread: true,
        isFavorite: false,
        lastAccessedAt: now,
        downloadedAt: now,
      });

      const pinned = service.togglePin('user_1', 'chap_1');
      expect(pinned).toBe(true);

      let inv = service.getVaultInventory('user_1');
      expect(inv[0].isPinned).toBe(true);

      const unpinned = service.togglePin('user_1', 'chap_1', false);
      expect(unpinned).toBe(false);

      inv = service.getVaultInventory('user_1');
      expect(inv[0].isPinned).toBe(false);
    });

    it('updates read timestamp and marks chapter read', () => {
      const oldTime = 1000000;
      service.registerDownloadedChapter({
        userId: 'user_1',
        seriesId: 's1',
        chapterId: 'c1',
        chapterNumber: 1,
        seriesTitle: 'Berserk',
        totalBytes: 15 * 1024 * 1024,
        totalPages: 22,
        isPinned: false,
        isUnread: true,
        isFavorite: false,
        lastAccessedAt: oldTime,
        downloadedAt: oldTime,
      });

      service.markChapterRead('user_1', 'c1');
      const inv = service.getVaultInventory('user_1');
      expect(inv[0].isUnread).toBe(false);
      expect(inv[0].lastAccessedAt).toBeGreaterThan(oldTime);
    });

    it('deletes a chapter manually', () => {
      const now = Date.now();
      service.registerDownloadedChapter({
        userId: 'user_1',
        seriesId: 's1',
        chapterId: 'c1',
        chapterNumber: 1,
        seriesTitle: 'Berserk',
        totalBytes: 15 * 1024 * 1024,
        totalPages: 22,
        isPinned: false,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: now,
        downloadedAt: now,
      });

      const deleted = service.deleteChapter('user_1', 'c1');
      expect(deleted).toBe(true);

      const inv = service.getVaultInventory('user_1');
      expect(inv).toHaveLength(0);
    });
  });

  describe('Quota Policies & Status Evaluation', () => {
    it('returns default quota policy if none saved', () => {
      const policy = service.getQuotaPolicy('user_new');
      expect(policy.userId).toBe('user_new');
      expect(policy.maxQuotaBytes).toBe(DEFAULT_QUOTA_POLICY.maxQuotaBytes);
      expect(policy.highWatermarkPct).toBe(0.75);
      expect(policy.lowWatermarkPct).toBe(0.65);
      expect(policy.autoEvictEnabled).toBe(true);
    });

    it('updates user quota policy and retrieves updated values', () => {
      const newPolicy: QuotaPolicyRecord = {
        userId: 'user_custom',
        maxQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 GB
        highWatermarkPct: 0.80,
        lowWatermarkPct: 0.70,
        autoEvictEnabled: false,
      };

      service.updateQuotaPolicy(newPolicy);
      const policy = service.getQuotaPolicy('user_custom');
      expect(policy.maxQuotaBytes).toBe(2 * 1024 * 1024 * 1024);
      expect(policy.highWatermarkPct).toBe(0.80);
      expect(policy.lowWatermarkPct).toBe(0.70);
      expect(policy.autoEvictEnabled).toBe(false);
    });

    it('calculates aggregate vault status summary accurately', () => {
      const now = Date.now();
      // Setup policy: 100 MB max
      service.updateQuotaPolicy({
        userId: 'user_stats',
        maxQuotaBytes: 100 * 1024 * 1024,
        highWatermarkPct: 0.75,
        lowWatermarkPct: 0.65,
        autoEvictEnabled: true,
      });

      // Chapter 1: 50MB (pinned)
      service.registerDownloadedChapter({
        userId: 'user_stats',
        seriesId: 's1',
        chapterId: 'c1',
        chapterNumber: 1,
        seriesTitle: 'Manga A',
        totalBytes: 50 * 1024 * 1024,
        totalPages: 30,
        isPinned: true,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: now,
        downloadedAt: now,
      });

      // Chapter 2: 30MB (unpinned)
      service.registerDownloadedChapter({
        userId: 'user_stats',
        seriesId: 's1',
        chapterId: 'c2',
        chapterNumber: 2,
        seriesTitle: 'Manga A',
        totalBytes: 30 * 1024 * 1024,
        totalPages: 25,
        isPinned: false,
        isUnread: true,
        isFavorite: false,
        lastAccessedAt: now,
        downloadedAt: now,
      });

      const status = service.getVaultStatus('user_stats');
      expect(status.totalChapters).toBe(2);
      expect(status.totalBytesUsed).toBe(80 * 1024 * 1024);
      expect(status.pinnedChapters).toBe(1);
      expect(status.pinnedBytes).toBe(50 * 1024 * 1024);
      expect(status.highWatermarkBytes).toBe(75 * 1024 * 1024);
      expect(status.lowWatermarkBytes).toBe(65 * 1024 * 1024);
      expect(status.usagePercentage).toBe(80);
      expect(status.isOverThreshold).toBe(true);
    });
  });

  describe('evaluateAndEvict Under Storage Pressure', () => {
    it('does not evict if total + required is below high watermark', () => {
      service.updateQuotaPolicy({
        userId: 'user_evict',
        maxQuotaBytes: 100 * 1024 * 1024, // 100 MB
        highWatermarkPct: 0.75, // 75 MB
        lowWatermarkPct: 0.65, // 65 MB
        autoEvictEnabled: true,
      });

      service.registerDownloadedChapter({
        userId: 'user_evict',
        seriesId: 's1',
        chapterId: 'c1',
        chapterNumber: 1,
        seriesTitle: 'Manga A',
        totalBytes: 40 * 1024 * 1024,
        totalPages: 20,
        isPinned: false,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: Date.now(),
        downloadedAt: Date.now(),
      });

      const res = service.evaluateAndEvict('user_evict', 20 * 1024 * 1024);
      expect(res.evictedChapters).toHaveLength(0);
      expect(res.bytesFreed).toBe(0);
      expect(res.newTotalBytes).toBe(40 * 1024 * 1024);
    });

    it('evicts unpinned chapters down to low watermark when exceeding high watermark', () => {
      const now = Date.now();
      // Quota: 100 MB -> High: 75 MB, Low: 65 MB
      service.updateQuotaPolicy({
        userId: 'user_evict',
        maxQuotaBytes: 100 * 1024 * 1024,
        highWatermarkPct: 0.75,
        lowWatermarkPct: 0.65,
        autoEvictEnabled: true,
      });

      // c1: 30MB, read 5 days ago (high eviction candidate)
      service.registerDownloadedChapter({
        userId: 'user_evict',
        seriesId: 's1',
        chapterId: 'c1',
        chapterNumber: 1,
        seriesTitle: 'Manga A',
        totalBytes: 30 * 1024 * 1024,
        totalPages: 20,
        isPinned: false,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: now - 5 * 86400000,
        downloadedAt: now - 5 * 86400000,
      });

      // c2: 30MB, read 10 days ago (highest eviction candidate)
      service.registerDownloadedChapter({
        userId: 'user_evict',
        seriesId: 's1',
        chapterId: 'c2',
        chapterNumber: 2,
        seriesTitle: 'Manga A',
        totalBytes: 30 * 1024 * 1024,
        totalPages: 20,
        isPinned: false,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: now - 10 * 86400000,
        downloadedAt: now - 10 * 86400000,
      });

      // c3: 20MB, pinned (immune)
      service.registerDownloadedChapter({
        userId: 'user_evict',
        seriesId: 's1',
        chapterId: 'c3',
        chapterNumber: 3,
        seriesTitle: 'Manga A',
        totalBytes: 20 * 1024 * 1024,
        totalPages: 15,
        isPinned: true,
        isUnread: false,
        isFavorite: false,
        lastAccessedAt: now - 15 * 86400000,
        downloadedAt: now - 15 * 86400000,
      });

      // Total used: 80 MB (already over 75 MB high watermark).
      // Incoming required: 10 MB.
      // Total needed to be below low watermark (65 MB - 10 MB = 55 MB max used).
      // Current unpinned: c2 (30MB), c1 (30MB).
      // Evicting c2 frees 30MB -> 80 - 30 = 50MB used. 50MB + 10MB = 60MB <= 65MB.
      const res = service.evaluateAndEvict('user_evict', 10 * 1024 * 1024);
      expect(res.evictedChapters).toContain('c2');
      expect(res.bytesFreed).toBe(30 * 1024 * 1024);
      expect(res.newTotalBytes).toBe(50 * 1024 * 1024);

      const inv = service.getVaultInventory('user_evict');
      expect(inv.map((c) => c.chapterId)).not.toContain('c2');
      expect(inv.map((c) => c.chapterId)).toContain('c1');
      expect(inv.map((c) => c.chapterId)).toContain('c3');
    });
  });
});
