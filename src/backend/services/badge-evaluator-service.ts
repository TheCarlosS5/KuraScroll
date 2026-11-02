import { DatabaseInstance } from '../db/database.js';
import { BadgeRepository, UserBadgeWithDefinition } from '../repositories/badge-repository.js';
import { BADGE_CATALOG } from '../badges/badge-definitions.js';
import { IOCoordinator } from '../storage/io/io-coordinator.js';
import { IOPriority } from '../storage/io/io-priority.js';

export interface EvaluationOptions {
  currentHour?: number;
  distinctGenresRead?: number;
  weekendDaysCompleted?: number;
}

export type BadgeUnlockedCallback = (badge: UserBadgeWithDefinition) => void;

/**
 * Sprint 31: BadgeEvaluatorService
 * Performs sub-millisecond badge requirement evaluation using point lookups
 * against pre-aggregated tables (user_reading_streaks, user_daily_activity).
 * ZERO full table scans or COUNT(*) queries on historical tables.
 */
export class BadgeEvaluatorService {
  private badgeRepo: BadgeRepository;
  private badgeUnlockedCallbacks: BadgeUnlockedCallback[] = [];

  constructor(
    private db: DatabaseInstance,
    private ioCoordinator?: IOCoordinator
  ) {
    this.badgeRepo = new BadgeRepository(db);
  }

  public onBadgeUnlocked(callback: BadgeUnlockedCallback): void {
    this.badgeUnlockedCallbacks.push(callback);
  }

  public getBadgeRepository(): BadgeRepository {
    return this.badgeRepo;
  }

  /**
   * Evaluates all badge progress for a user in sub-millisecond execution time.
   * Returns newly unlocked badges.
   */
  public async evaluateUserBadges(
    userId: string,
    options: EvaluationOptions = {}
  ): Promise<UserBadgeWithDefinition[]> {
    // Point Lookup 1: user_reading_streaks (indexed on user_id)
    const streakRow = this.db
      .prepare(`
        SELECT total_pages_read, current_streak, longest_streak 
        FROM user_reading_streaks 
        WHERE user_id = ?
      `)
      .get(userId) as any;

    const totalPages = streakRow ? streakRow.total_pages_read : 0;
    const currentStreak = streakRow ? streakRow.current_streak : 0;
    const longestStreak = streakRow ? Math.max(streakRow.longest_streak, currentStreak) : 0;

    // Time-based check (Búho nocturno)
    const hour = options.currentHour ?? new Date().getHours();
    const isNightReading = hour >= 23 || hour < 4;

    const updates: Array<{ badgeId: string; currentValue: number }> = [];

    for (const def of BADGE_CATALOG) {
      let currentValue = 0;

      switch (def.id) {
        case 'first_step':
          currentValue = totalPages >= 1 ? 1 : 0;
          break;
        case 'page_devourer_100':
        case 'page_devourer_500':
        case 'page_devourer_1000':
          currentValue = totalPages;
          break;
        case 'streak_3':
        case 'streak_7':
        case 'streak_30':
          currentValue = longestStreak;
          break;
        case 'night_owl':
          currentValue = isNightReading ? 1 : 0;
          break;
        case 'weekend_warrior':
          currentValue = options.weekendDaysCompleted ?? 0;
          break;
        case 'genre_explorer':
          currentValue = options.distinctGenresRead ?? 0;
          break;
        default:
          currentValue = 0;
      }

      updates.push({ badgeId: def.id, currentValue });
    }

    let newlyUnlocked: UserBadgeWithDefinition[] = [];

    const executeBatch = () => {
      newlyUnlocked = this.badgeRepo.batchUpdateProgress(userId, updates);
    };

    if (this.ioCoordinator) {
      await this.ioCoordinator.run({ priority: IOPriority.NORMAL }, async () => {
        executeBatch();
      });
    } else {
      executeBatch();
    }

    if (newlyUnlocked.length > 0) {
      for (const badge of newlyUnlocked) {
        for (const cb of this.badgeUnlockedCallbacks) {
          try {
            cb(badge);
          } catch {
            // Safe guard against listener errors
          }
        }
      }
    }

    return newlyUnlocked;
  }
}
