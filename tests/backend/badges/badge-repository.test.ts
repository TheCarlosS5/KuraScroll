import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { BadgeRepository } from '../../../src/backend/repositories/badge-repository';
import { BADGE_CATALOG, BADGE_MAP } from '../../../src/backend/badges/badge-definitions';

describe('Sprint 31: Badge Catalog Definitions & BadgeRepository', () => {
  let db: DatabaseInstance;
  let repo: BadgeRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new BadgeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // 1. Badge Definitions Catalog Verification
  // =========================================================================
  describe('1. Badge Catalog Definitions', () => {
    it('contains all 12 initial badges across the 5 canonical categories', () => {
      expect(BADGE_CATALOG.length).toBe(12);

      const requiredIds = [
        'first_step',
        'page_devourer_100',
        'page_devourer_500',
        'page_devourer_1000',
        'streak_3',
        'streak_7',
        'streak_30',
        'night_owl',
        'weekend_warrior',
        'genre_explorer',
        'volume_master',
        'speed_reader',
      ];

      for (const id of requiredIds) {
        expect(BADGE_MAP.has(id)).toBe(true);
        const badge = BADGE_MAP.get(id)!;
        expect(badge.id).toBe(id);
        expect(badge.title).toBeTruthy();
        expect(badge.description).toBeTruthy();
        expect(badge.icon).toBeTruthy();
        expect(['volume', 'streak', 'time', 'explorer', 'collector']).toContain(badge.category);
        expect(['common', 'rare', 'epic', 'legendary']).toContain(badge.rarity);
        expect(badge.targetValue).toBeGreaterThan(0);
      }
    });

    it('defines appropriate rarities and target values for milestone badges', () => {
      expect(BADGE_MAP.get('first_step')?.rarity).toBe('common');
      expect(BADGE_MAP.get('page_devourer_100')?.rarity).toBe('common');
      expect(BADGE_MAP.get('page_devourer_500')?.rarity).toBe('rare');
      expect(BADGE_MAP.get('page_devourer_1000')?.rarity).toBe('epic');
      expect(BADGE_MAP.get('streak_30')?.rarity).toBe('legendary');
    });
  });

  // =========================================================================
  // 2. Repository User Progress Retrieval
  // =========================================================================
  describe('2. getUserBadges & Defaults', () => {
    it('returns all 12 catalog badges for a new user with 0% progress and isUnlocked false', () => {
      const badges = repo.getUserBadges('new_user_1');
      expect(badges.length).toBe(12);

      for (const b of badges) {
        expect(b.userId).toBe('new_user_1');
        expect(b.currentValue).toBe(0);
        expect(b.isUnlocked).toBe(false);
        expect(b.unlockedAt).toBeNull();
        expect(b.progressPercent).toBe(0);
      }
    });
  });

  // =========================================================================
  // 3. Incremental Updates & Threshold Unlocking
  // =========================================================================
  describe('3. updateBadgeProgress & Unlocking Lifecycle', () => {
    it('tracks partial progress without prematurely unlocking', () => {
      const res = repo.updateBadgeProgress('reader_a', 'page_devourer_100', 45);
      expect(res.unlockedNow).toBe(false);
      expect(res.badge.currentValue).toBe(45);
      expect(res.badge.isUnlocked).toBe(false);
      expect(res.badge.unlockedAt).toBeNull();
      expect(res.badge.progressPercent).toBe(45);
    });

    it('triggers unlockedNow true and sets unlockedAt when threshold is achieved', () => {
      const res = repo.updateBadgeProgress('reader_a', 'page_devourer_100', 105);
      expect(res.unlockedNow).toBe(true);
      expect(res.badge.currentValue).toBe(105);
      expect(res.badge.isUnlocked).toBe(true);
      expect(res.badge.unlockedAt).not.toBeNull();
      expect(res.badge.progressPercent).toBe(100);
      expect(res.badge.notified).toBe(false);
    });

    it('preserves initial unlockedAt timestamp across subsequent reading updates', () => {
      // Step 1: Unlock
      const first = repo.updateBadgeProgress('reader_b', 'page_devourer_100', 100);
      expect(first.unlockedNow).toBe(true);
      const originalTimestamp = first.badge.unlockedAt;

      // Step 2: Read more pages
      const second = repo.updateBadgeProgress('reader_b', 'page_devourer_100', 150);
      expect(second.unlockedNow).toBe(false); // already unlocked previously
      expect(second.badge.currentValue).toBe(150);
      expect(second.badge.isUnlocked).toBe(true);
      expect(second.badge.unlockedAt).toBe(originalTimestamp);
    });
  });

  // =========================================================================
  // 4. Fast Lookup & Notification Management
  // =========================================================================
  describe('4. getUnlockedBadges, Notifications & Summary', () => {
    it('retrieves only unlocked badges ordered by unlockedAt DESC via covering index', () => {
      repo.updateBadgeProgress('user_x', 'first_step', 1);
      repo.updateBadgeProgress('user_x', 'streak_3', 3);
      repo.updateBadgeProgress('user_x', 'page_devourer_100', 20); // Not unlocked

      const unlocked = repo.getUnlockedBadges('user_x');
      expect(unlocked.length).toBe(2);
      expect(unlocked.map((u) => u.id)).toContain('first_step');
      expect(unlocked.map((u) => u.id)).toContain('streak_3');
      expect(unlocked.map((u) => u.id)).not.toContain('page_devourer_100');
    });

    it('detects unnotified badges and marks them notified for celebration toasts', () => {
      repo.updateBadgeProgress('toast_user', 'first_step', 1);
      repo.updateBadgeProgress('toast_user', 'streak_3', 3);

      const unnotified = repo.getUnnotifiedBadges('toast_user');
      expect(unnotified.length).toBe(2);

      repo.markBadgesNotified('toast_user', ['first_step']);
      const remainingUnnotified = repo.getUnnotifiedBadges('toast_user');
      expect(remainingUnnotified.length).toBe(1);
      expect(remainingUnnotified[0].id).toBe('streak_3');
    });

    it('computes accurate badge summary statistics for profile headers', () => {
      repo.updateBadgeProgress('summary_user', 'first_step', 1); // Unlocked (1)
      repo.updateBadgeProgress('summary_user', 'page_devourer_100', 50); // In-progress (1)
      repo.updateBadgeProgress('summary_user', 'streak_3', 0); // 0 progress

      const summary = repo.getBadgeSummary('summary_user');
      expect(summary.total).toBe(12);
      expect(summary.unlocked).toBe(1);
      expect(summary.inProgress).toBe(1);
      expect(summary.percentage).toBe(Math.round((1 / 12) * 100)); // 8%
    });
  });

  // =========================================================================
  // 5. Batch Progress Updates in Atomic Transaction
  // =========================================================================
  describe('5. batchUpdateProgress', () => {
    it('processes batch updates in a single transaction and reports newly unlocked badges', () => {
      const newlyUnlocked = repo.batchUpdateProgress('batch_user', [
        { badgeId: 'first_step', currentValue: 1 }, // Unlocks
        { badgeId: 'page_devourer_100', currentValue: 30 }, // In progress
        { badgeId: 'night_owl', currentValue: 1 }, // Unlocks
      ]);

      expect(newlyUnlocked.length).toBe(2);
      expect(newlyUnlocked.map((b) => b.id).sort()).toEqual(['first_step', 'night_owl'].sort());

      const unlockedAll = repo.getUnlockedBadges('batch_user');
      expect(unlockedAll.length).toBe(2);
    });
  });
});
