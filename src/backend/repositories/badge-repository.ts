import { DatabaseInstance } from '../db/database.js';
import {
  BADGE_CATALOG,
  BADGE_MAP,
  BadgeDefinition,
  BadgeCategory,
  BadgeRarity,
} from '../badges/badge-definitions.js';

export interface UserBadgeRecord {
  userId: string;
  badgeId: string;
  currentValue: number;
  targetValue: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
  notified: boolean;
  updatedAt: string;
}

export interface UserBadgeWithDefinition extends BadgeDefinition {
  userId: string;
  currentValue: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
  notified: boolean;
  progressPercent: number;
}

export interface BadgeSummary {
  total: number;
  unlocked: number;
  inProgress: number;
  percentage: number;
}

export class BadgeRepository {
  constructor(private db: DatabaseInstance) {}

  /**
   * Retrieves all badges from the catalog merged with the user's progress.
   * Ensures that unearned badges are returned with default 0 progress.
   */
  getUserBadges(userId: string): UserBadgeWithDefinition[] {
    const stmt = this.db.prepare(`
      SELECT 
        badge_id,
        current_value,
        target_value,
        is_unlocked,
        unlocked_at,
        notified,
        updated_at
      FROM user_badges
      WHERE user_id = ?
    `);

    const rows = stmt.all(userId) as any[];
    const progressMap = new Map<string, any>(rows.map((r) => [r.badge_id, r]));

    return BADGE_CATALOG.map((def) => {
      const record = progressMap.get(def.id);
      const currentValue = record ? record.current_value : 0;
      const isUnlocked = record ? Boolean(record.is_unlocked) : false;
      const unlockedAt = record ? record.unlocked_at : null;
      const notified = record ? Boolean(record.notified) : false;
      const progressPercent = Math.min(100, Math.round((currentValue / def.targetValue) * 100));

      return {
        ...def,
        userId,
        currentValue,
        isUnlocked,
        unlockedAt,
        notified,
        progressPercent,
      };
    });
  }

  /**
   * High-speed lookup of unlocked badges using covering index idx_user_badges_unlocked.
   */
  getUnlockedBadges(userId: string): UserBadgeWithDefinition[] {
    const stmt = this.db.prepare(`
      SELECT 
        badge_id,
        current_value,
        target_value,
        is_unlocked,
        unlocked_at,
        notified
      FROM user_badges
      WHERE user_id = ? AND is_unlocked = 1
      ORDER BY unlocked_at DESC
    `);

    const rows = stmt.all(userId) as any[];

    return rows
      .map((r) => {
        const def = BADGE_MAP.get(r.badge_id);
        if (!def) return null;
        return {
          ...def,
          userId,
          currentValue: r.current_value,
          isUnlocked: true,
          unlockedAt: r.unlocked_at,
          notified: Boolean(r.notified),
          progressPercent: 100,
        };
      })
      .filter((b): b is UserBadgeWithDefinition => b !== null);
  }

  /**
   * Retrieves unlocked badges that haven't triggered a celebration toast yet.
   */
  getUnnotifiedBadges(userId: string): UserBadgeWithDefinition[] {
    const stmt = this.db.prepare(`
      SELECT 
        badge_id,
        current_value,
        target_value,
        is_unlocked,
        unlocked_at,
        notified
      FROM user_badges
      WHERE user_id = ? AND is_unlocked = 1 AND notified = 0
      ORDER BY unlocked_at ASC
    `);

    const rows = stmt.all(userId) as any[];

    return rows
      .map((r) => {
        const def = BADGE_MAP.get(r.badge_id);
        if (!def) return null;
        return {
          ...def,
          userId,
          currentValue: r.current_value,
          isUnlocked: true,
          unlockedAt: r.unlocked_at,
          notified: false,
          progressPercent: 100,
        };
      })
      .filter((b): b is UserBadgeWithDefinition => b !== null);
  }

  /**
   * Marks unlocked badges as notified to prevent duplicate celebration toasts.
   */
  markBadgesNotified(userId: string, badgeIds: string[]): void {
    if (!badgeIds || badgeIds.length === 0) return;

    const placeholders = badgeIds.map(() => '?').join(', ');
    const stmt = this.db.prepare(`
      UPDATE user_badges
      SET notified = 1, updated_at = datetime('now')
      WHERE user_id = ? AND badge_id IN (${placeholders})
    `);

    stmt.run(userId, ...badgeIds);
  }

  /**
   * Atomically updates a single badge's progress, triggers unlock if threshold is met,
   * locks in unlocked_at timestamp, and detects if the badge was newly unlocked in this call.
   */
  updateBadgeProgress(
    userId: string,
    badgeId: string,
    currentValue: number
  ): { unlockedNow: boolean; badge: UserBadgeWithDefinition } {
    const def = BADGE_MAP.get(badgeId);
    if (!def) {
      throw new Error(`Unknown badge id: ${badgeId}`);
    }

    const previousRow = this.db
      .prepare('SELECT is_unlocked FROM user_badges WHERE user_id = ? AND badge_id = ?')
      .get(userId, badgeId) as any;
    const wasUnlocked = previousRow ? Boolean(previousRow.is_unlocked) : false;

    const stmt = this.db.prepare(`
      INSERT INTO user_badges (
        user_id, badge_id, current_value, target_value, is_unlocked, unlocked_at, notified, updated_at
      ) VALUES (
        :userId, :badgeId, :currentValue, :targetValue,
        CASE WHEN :currentValue >= :targetValue THEN 1 ELSE 0 END,
        CASE WHEN :currentValue >= :targetValue THEN datetime('now') ELSE NULL END,
        0,
        datetime('now')
      )
      ON CONFLICT(user_id, badge_id) DO UPDATE SET
        current_value = MAX(user_badges.current_value, excluded.current_value),
        is_unlocked = CASE 
          WHEN user_badges.is_unlocked = 1 THEN 1
          WHEN MAX(user_badges.current_value, excluded.current_value) >= user_badges.target_value THEN 1
          ELSE 0
        END,
        unlocked_at = CASE 
          WHEN user_badges.is_unlocked = 1 THEN user_badges.unlocked_at
          WHEN MAX(user_badges.current_value, excluded.current_value) >= user_badges.target_value THEN datetime('now')
          ELSE NULL
        END,
        updated_at = datetime('now')
    `);

    stmt.run({
      userId,
      badgeId,
      currentValue: Math.max(0, currentValue),
      targetValue: def.targetValue,
    });

    const updatedRow = this.db
      .prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?')
      .get(userId, badgeId) as any;

    const isUnlockedNow = Boolean(updatedRow.is_unlocked);
    const unlockedNow = !wasUnlocked && isUnlockedNow;

    const badge: UserBadgeWithDefinition = {
      ...def,
      userId,
      currentValue: updatedRow.current_value,
      isUnlocked: isUnlockedNow,
      unlockedAt: updatedRow.unlocked_at,
      notified: Boolean(updatedRow.notified),
      progressPercent: Math.min(100, Math.round((updatedRow.current_value / def.targetValue) * 100)),
    };

    return { unlockedNow, badge };
  }

  /**
   * Batch updates progress for multiple badges within an atomic SQLite transaction.
   * Returns an array of all badges that were newly unlocked during this batch.
   */
  batchUpdateProgress(
    userId: string,
    updates: Array<{ badgeId: string; currentValue: number }>
  ): UserBadgeWithDefinition[] {
    if (!updates || updates.length === 0) return [];

    const newlyUnlocked: UserBadgeWithDefinition[] = [];

    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const update of updates) {
        const result = this.updateBadgeProgress(userId, update.badgeId, update.currentValue);
        if (result.unlockedNow) {
          newlyUnlocked.push(result.badge);
        }
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return newlyUnlocked;
  }

  /**
   * Computes an overview of badge achievements for profile headers and dashboards.
   */
  getBadgeSummary(userId: string): BadgeSummary {
    const badges = this.getUserBadges(userId);
    const total = badges.length;
    let unlocked = 0;
    let inProgress = 0;

    for (const b of badges) {
      if (b.isUnlocked) {
        unlocked++;
      } else if (b.currentValue > 0) {
        inProgress++;
      }
    }

    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    return {
      total,
      unlocked,
      inProgress,
      percentage,
    };
  }
}
