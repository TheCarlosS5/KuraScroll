import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  CloudlessSyncService,
  resolveVectorClockMerge,
  normalizeSyncMode,
  computeSyncMilestoneEtag,
} from '../../../../src/backend/services/cloudless-sync-service.js';

describe('CloudlessSyncService (Sprint 85)', () => {
  let db: DatabaseInstance;
  let service: CloudlessSyncService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_milestone_profiles (
        series_id TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'default_user',
        device_id TEXT NOT NULL,
        vector_clock INTEGER NOT NULL DEFAULT 1,
        chapters_completed INTEGER NOT NULL DEFAULT 0,
        total_reading_seconds INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 1,
        sync_mode TEXT NOT NULL DEFAULT 'local_broadcast' CHECK (sync_mode IN ('local_broadcast', 'p2p_direct', 'offline_vault')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (series_id, user_id, device_id)
      );
    `);
    service = new CloudlessSyncService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns default fallback profile when series has no entry in DB', () => {
    const profile = service.getProfile('unregistered-series', 'user1');
    expect(profile.seriesId).toBe('unregistered-series');
    expect(profile.userId).toBe('user1');
    expect(profile.syncMode).toBe('local_broadcast');
    expect(profile.vectorClock).toBe(1);
    expect(profile.chaptersCompleted).toBe(0);
    expect(profile.streakDays).toBe(1);
    expect(profile.isEnabled).toBe(true);
  });

  it('saves and retrieves customized sync milestone profiles', () => {
    const saved = service.saveProfile({
      seriesId: 'series-frieren',
      userId: 'carlos',
      deviceId: 'laptop_carlos',
      vectorClock: 12,
      chaptersCompleted: 45,
      totalReadingSeconds: 7200,
      streakDays: 7,
      syncMode: 'p2p_direct',
      isEnabled: true,
    });

    expect(saved.seriesId).toBe('series-frieren');
    expect(saved.userId).toBe('carlos');
    expect(saved.vectorClock).toBe(12);
    expect(saved.chaptersCompleted).toBe(45);

    const retrieved = service.getProfile('series-frieren', 'carlos');
    expect(retrieved.deviceId).toBe('laptop_carlos');
    expect(retrieved.syncMode).toBe('p2p_direct');
    expect(retrieved.chaptersCompleted).toBe(45);
  });

  it('computes stable deterministic ETags', () => {
    const etag1 = computeSyncMilestoneEtag('frieren', 'dev1', 5, 20, 3600);
    const etag2 = computeSyncMilestoneEtag('frieren', 'dev1', 5, 20, 3600);
    const etag3 = computeSyncMilestoneEtag('frieren', 'dev2', 5, 20, 3600);

    expect(etag1).toBe(etag2);
    expect(etag1).not.toBe(etag3);
    expect(etag1.startsWith('W/"cs-')).toBe(true);
  });

  it('normalizes invalid sync modes gracefully', () => {
    expect(normalizeSyncMode('unknown')).toBe('local_broadcast');
    expect(normalizeSyncMode('p2p_direct')).toBe('p2p_direct');
  });

  describe('resolveVectorClockMerge (SLA 49)', () => {
    it('selects higher vector clock source deterministically', () => {
      // Local clock 10 vs Remote clock 15 -> remote wins
      const res = resolveVectorClockMerge(10, 15, 20, 35, 1000, 2500, 100, 100);
      expect(res.winningSource).toBe('remote');
      expect(res.resolvedChapters).toBe(35);
      expect(res.resolvedSeconds).toBe(2500);
      expect(res.mergedClock).toBe(16); // max(10, 15) + 1
      expect(res.isConflictResolved).toBe(false);
    });

    it('resolves vector clock ties with Last-Write-Wins (LWW) timestamp', () => {
      // Both clocks = 10, local timestamp newer
      const res = resolveVectorClockMerge(10, 10, 30, 25, 2000, 1500, 5000, 4000);
      expect(res.winningSource).toBe('local');
      expect(res.resolvedChapters).toBe(30);
      expect(res.mergedClock).toBe(11);
      expect(res.isConflictResolved).toBe(true);
    });

    it('handles identical state gracefully', () => {
      const res = resolveVectorClockMerge(5, 5, 10, 10, 600, 600, 1000, 1000);
      expect(res.winningSource).toBe('equal');
      expect(res.resolvedChapters).toBe(10);
      expect(res.mergedClock).toBe(6);
    });
  });

  describe('reconcilePeerState', () => {
    it('merges remote state and bumps vector clock', () => {
      const local = service.saveProfile({
        seriesId: 'series-vinland',
        userId: 'carlos',
        deviceId: 'local_dev',
        vectorClock: 4,
        chaptersCompleted: 10,
        totalReadingSeconds: 3000,
        streakDays: 3,
        syncMode: 'local_broadcast',
        isEnabled: true,
      });

      const reconciled = service.reconcilePeerState(local, {
        deviceId: 'tablet_dev',
        vectorClock: 8,
        chaptersCompleted: 15,
        totalReadingSeconds: 4500,
        timestamp: Date.now() + 1000,
      });

      expect(reconciled.vectorClock).toBe(9);
      expect(reconciled.chaptersCompleted).toBe(15);
      expect(reconciled.totalReadingSeconds).toBe(4500);
    });
  });
});
