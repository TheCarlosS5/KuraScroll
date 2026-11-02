/**
 * KuraScroll Sprint 94: Storage Tier Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  StorageTierService,
  STORAGE_TIERING_PRESETS,
  StorageTierProfile,
  TieringCandidateInput,
} from '../../../../src/backend/services/storage-tier-service.js';

describe('StorageTierService', () => {
  let db: DatabaseInstance;
  let service: StorageTierService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS storage_tier_profiles (
        series_id TEXT PRIMARY KEY,
        auto_tiering_mode TEXT NOT NULL DEFAULT 'balanced_hybrid' CHECK (auto_tiering_mode IN (
            'aggressive_evict',
            'balanced_hybrid',
            'archive_pin',
            'custom'
        )),
        hot_retention_days INTEGER NOT NULL DEFAULT 14 CHECK (hot_retention_days >= 1 AND hot_retention_days <= 180),
        warm_retention_days INTEGER NOT NULL DEFAULT 60 CHECK (warm_retention_days >= 7 AND warm_retention_days <= 365),
        disk_quota_target_gb INTEGER NOT NULL DEFAULT 3500 CHECK (disk_quota_target_gb >= 100 AND disk_quota_target_gb <= 4000),
        is_auto_eviction_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_auto_eviction_enabled IN (0, 1)),
        is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_storage_tier_lookup ON storage_tier_profiles(series_id);
    `);
    service = new StorageTierService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateTieringPlan', () => {
    const nowMs = 1700000000000;
    const dayMs = 86400000;

    it('keeps actively read recent chapters in Hot tier', () => {
      const candidates: TieringCandidateInput[] = [
        {
          chapterId: 'ch-active',
          seriesId: 'series-active',
          sizeBytes: 15_000_000,
          lastReadAt: nowMs - (2 * dayMs), // 2 days ago
          readCount: 12,
          isCompleted: false,
          isPinned: false,
          currentTier: 'tier_hot',
        },
      ];

      const plan = service.calculateTieringPlan(candidates, { autoTieringMode: 'balanced_hybrid' }, nowMs);
      expect(plan.hotCount).toBe(1);
      expect(plan.warmCount).toBe(0);
      expect(plan.coldCount).toBe(0);
      expect(plan.evictionCandidateCount).toBe(0);
      expect(plan.candidates[0].recommendedTier).toBe('tier_hot');
      expect(plan.candidates[0].shouldEvict).toBe(false);
    });

    it('protects pinned series chapters permanently from eviction', () => {
      const candidates: TieringCandidateInput[] = [
        {
          chapterId: 'ch-pinned',
          seriesId: 'series-fav',
          sizeBytes: 25_000_000,
          lastReadAt: nowMs - (300 * dayMs), // 300 days idle
          readCount: 1,
          isCompleted: true,
          isPinned: true,
          currentTier: 'tier_warm',
        },
      ];

      const plan = service.calculateTieringPlan(candidates, { autoTieringMode: 'aggressive_evict' }, nowMs);
      expect(plan.candidates[0].recommendedTier).toBe('tier_hot');
      expect(plan.candidates[0].evictionScore).toBe(0);
      expect(plan.candidates[0].shouldEvict).toBe(false);
      expect(plan.evictionCandidateCount).toBe(0);
    });

    it('demotes cold idle backlog and flags for auto-eviction', () => {
      const candidates: TieringCandidateInput[] = [
        {
          chapterId: 'ch-cold-backlog',
          seriesId: 'series-done',
          sizeBytes: 30_000_000,
          lastReadAt: nowMs - (120 * dayMs), // 120 days idle (exceeds 60d warm)
          readCount: 1,
          isCompleted: true,
          isPinned: false,
          currentTier: 'tier_warm',
        },
      ];

      const plan = service.calculateTieringPlan(candidates, {
        autoTieringMode: 'balanced_hybrid',
        isAutoEvictionEnabled: true,
      }, nowMs);

      expect(plan.coldCount).toBe(1);
      expect(plan.evictionCandidateCount).toBe(1);
      expect(plan.totalReclaimableBytes).toBe(30_000_000);
      expect(plan.candidates[0].recommendedTier).toBe('tier_cold');
      expect(plan.candidates[0].shouldEvict).toBe(true);
      expect(plan.candidates[0].evictionScore).toBeGreaterThanOrEqual(60);
    });

    it('does not flag for eviction when auto-eviction is disabled', () => {
      const candidates: TieringCandidateInput[] = [
        {
          chapterId: 'ch-archive',
          seriesId: 'series-archive',
          sizeBytes: 30_000_000,
          lastReadAt: nowMs - (200 * dayMs),
          readCount: 2,
          isCompleted: true,
          isPinned: false,
          currentTier: 'tier_warm',
        },
      ];

      const plan = service.calculateTieringPlan(candidates, {
        autoTieringMode: 'archive_pin',
        isAutoEvictionEnabled: false,
      }, nowMs);

      expect(plan.coldCount).toBe(1);
      expect(plan.evictionCandidateCount).toBe(0);
      expect(plan.candidates[0].shouldEvict).toBe(false);
    });
  });

  describe('getProfile / setProfile', () => {
    it('returns default fallback profile when series does not exist', () => {
      const prof = service.getProfile('series-empty');
      expect(prof.seriesId).toBe('series-empty');
      expect(prof.autoTieringMode).toBe('balanced_hybrid');
      expect(prof.hotRetentionDays).toBe(14);
      expect(prof.warmRetentionDays).toBe(60);
      expect(prof.diskQuotaTargetGb).toBe(3500);
      expect(prof.isAutoEvictionEnabled).toBe(true);
      expect(prof.isPinned).toBe(false);
    });

    it('persists and retrieves updated profile in SQLite', () => {
      const updated = service.setProfile({
        seriesId: 'vagabond-archive',
        autoTieringMode: 'archive_pin',
        hotRetentionDays: 30,
        warmRetentionDays: 180,
        diskQuotaTargetGb: 3800,
        isAutoEvictionEnabled: false,
        isPinned: true,
        updatedAt: Date.now(),
      });

      expect(updated.autoTieringMode).toBe('archive_pin');
      expect(updated.isPinned).toBe(true);

      const retrieved = service.getProfile('vagabond-archive');
      expect(retrieved.autoTieringMode).toBe('archive_pin');
      expect(retrieved.isPinned).toBe(true);
      expect(retrieved.hotRetentionDays).toBe(30);
    });
  });
});
