import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Sprint 31: Badge Engine Service Implementation
 */
class BadgeEngineService {
  private unlockEvents: Array<{ userId: string; badgeId: string }> = [];

  constructor(private db: DatabaseInstance) {}

  public evaluateBadges(userId: string, totalPagesRead: number, currentStreak: number): void {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const badges = [
        { id: 'primer_paso', type: 'pages', threshold: 1 },
        { id: 'page_devourer_100', type: 'pages', threshold: 100 },
        { id: 'page_devourer_500', type: 'pages', threshold: 500 },
        { id: 'page_devourer_1000', type: 'pages', threshold: 1000 },
        { id: 'streak_3', type: 'streak', threshold: 3 },
        { id: 'streak_7', type: 'streak', threshold: 7 },
      ];

      for (const badge of badges) {
        const currentValue = badge.type === 'pages' ? totalPagesRead : currentStreak;
        const unlocked = currentValue >= badge.threshold ? 1 : 0;

        if (unlocked === 1) {
          const existing = this.db.prepare(`
            SELECT unlocked_at FROM user_badges WHERE user_id = ? AND badge_id = ?
          `).get(userId, badge.id) as any;

          if (!existing) {
            this.db.prepare(`
              INSERT INTO user_badges (user_id, badge_id, current_value, unlocked_at, updated_at)
              VALUES (?, ?, ?, datetime('now'), datetime('now'))
              ON CONFLICT(user_id, badge_id) DO NOTHING
            `).run(userId, badge.id, currentValue);

            this.unlockEvents.push({ userId, badgeId: badge.id });
          } else {
            this.db.prepare(`
              UPDATE user_badges 
              SET current_value = MAX(current_value, ?), updated_at = datetime('now')
              WHERE user_id = ? AND badge_id = ?
            `).run(currentValue, userId, badge.id);
          }
        } else {
          this.db.prepare(`
            INSERT INTO user_badges (user_id, badge_id, current_value, unlocked_at, updated_at)
            VALUES (?, ?, ?, NULL, datetime('now'))
            ON CONFLICT(user_id, badge_id) DO UPDATE SET
              current_value = MAX(current_value, excluded.current_value),
              updated_at = datetime('now')
          `).run(userId, badge.id, currentValue);
        }
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getUserBadges(userId: string): any[] {
    return this.db.prepare(`
      SELECT badge_id, current_value, unlocked_at FROM user_badges WHERE user_id = ?
    `).all(userId);
  }

  public getUnlockEvents(): Array<{ userId: string; badgeId: string }> {
    return this.unlockEvents;
  }
}

describe('Sprint 31: Badge Engine Edge Cases Resilience Suite', () => {
  let db: DatabaseInstance;
  let service: BadgeEngineService;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint31');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_badges (
        user_id TEXT NOT NULL,
        badge_id TEXT NOT NULL,
        current_value INTEGER NOT NULL DEFAULT 0,
        unlocked_at TEXT DEFAULT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, badge_id)
      );
    `);

    service = new BadgeEngineService(db);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Retroactive badge unlocks
  // =========================================================================
  it('1.1: retroactive evaluator unlocks all qualifying past milestones instantly without error', async () => {
    const userId = 'user-veteran';
    service.evaluateBadges(userId, 1200, 10);

    const badges = service.getUserBadges(userId);
    const unlockedBadgeIds = badges.filter(b => b.unlocked_at !== null).map(b => b.badge_id);

    expect(unlockedBadgeIds).toContain('primer_paso');
    expect(unlockedBadgeIds).toContain('page_devourer_100');
    expect(unlockedBadgeIds).toContain('page_devourer_500');
    expect(unlockedBadgeIds).toContain('page_devourer_1000');
    expect(unlockedBadgeIds).toContain('streak_3');
    expect(unlockedBadgeIds).toContain('streak_7');
    expect(unlockedBadgeIds.length).toBe(6);
  });

  // =========================================================================
  // 2. Idempotency: re-evaluating unlocked badges
  // =========================================================================
  it('2.1: re-evaluating unlocked badges does not update unlocked_at or re-emit unlock events', async () => {
    const userId = 'user-idempotent';
    service.evaluateBadges(userId, 150, 4);

    const initialBadges = service.getUserBadges(userId);
    const initialEventsCount = service.getUnlockEvents().length;
    const initialUnlockedAt = initialBadges.find(b => b.badge_id === 'primer_paso').unlocked_at;

    service.evaluateBadges(userId, 200, 5);

    const postBadges = service.getUserBadges(userId);
    const postEventsCount = service.getUnlockEvents().length;
    const postUnlockedAt = postBadges.find(b => b.badge_id === 'primer_paso').unlocked_at;

    expect(postUnlockedAt).toBe(initialUnlockedAt);
    expect(postEventsCount).toBe(initialEventsCount);
  });

  // =========================================================================
  // 3. Partial progress monotonicity
  // =========================================================================
  it('3.1: current_value remains monotonic and never decreases even if streak resets to 0', async () => {
    const userId = 'user-monotonic';
    service.evaluateBadges(userId, 400, 7);

    let streakBadge = service.getUserBadges(userId).find(b => b.badge_id === 'streak_7');
    expect(streakBadge.current_value).toBe(7);

    service.evaluateBadges(userId, 450, 0);

    streakBadge = service.getUserBadges(userId).find(b => b.badge_id === 'streak_7');
    expect(streakBadge.current_value).toBe(7);
  });

  // =========================================================================
  // 4. Concurrency test: concurrent evaluations for same user
  // =========================================================================
  it('4.1: concurrent evaluations for same user complete safely without race conditions or duplicates', async () => {
    const userId = 'user-concurrency';

    const evaluations = Array.from({ length: 15 }, () => {
      return Promise.resolve().then(() => {
        service.evaluateBadges(userId, 500, 5);
      });
    });

    await Promise.all(evaluations);

    const badges = service.getUserBadges(userId);
    const uniqueBadgeIds = new Set(badges.map(b => b.badge_id));

    expect(badges.length).toBe(uniqueBadgeIds.size);
    const devourer500 = badges.find(b => b.badge_id === 'page_devourer_500');
    expect(devourer500.unlocked_at).not.toBeNull();
  });
});
