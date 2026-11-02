import { DatabaseInstance } from '../db/database.js';

export interface ReadingStreakResult {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string | null;
  totalPagesRead: number;
  totalReadingSeconds: number;
  totalReadingMinutes: number;
  isStreakActiveToday: boolean;
  flameLevel: number;
}

function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T00:00:00Z').getTime();
  const d2 = new Date(dateStr2 + 'T00:00:00Z').getTime();
  const diffMs = Math.abs(d2 - d1);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function calculateFlameLevel(streakDays: number): number {
  if (streakDays <= 0) return 0;
  if (streakDays < 3) return 1;
  if (streakDays < 7) return 2;
  if (streakDays < 30) return 3;
  return 4;
}

export class ReadingStreakService {
  constructor(private db: DatabaseInstance) {}

  public recordActivity(
    userId = 'local_user',
    pagesRead = 1,
    durationSeconds = 0,
    activityDate?: string
  ): ReadingStreakResult {
    const today = activityDate || new Date().toISOString().split('T')[0];

    const getStmt = this.db.prepare(`
      SELECT user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds
      FROM user_reading_streaks
      WHERE user_id = ?
    `);

    const existing = getStmt.get(userId) as any;

    if (!existing) {
      const insertStmt = this.db.prepare(`
        INSERT INTO user_reading_streaks (
          user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds, updated_at
        ) VALUES (?, 1, 1, ?, ?, ?, datetime('now'))
      `);
      insertStmt.run(userId, today, pagesRead, durationSeconds);

      return {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastReadDate: today,
        totalPagesRead: pagesRead,
        totalReadingSeconds: durationSeconds,
        totalReadingMinutes: Math.round(durationSeconds / 60),
        isStreakActiveToday: true,
        flameLevel: 1,
      };
    }

    let newCurrentStreak = existing.current_streak;
    let newLongestStreak = existing.longest_streak;
    const lastDate = existing.last_read_date;

    if (lastDate === today) {
      // Activity recorded on the same day: streak unchanged, accumulate pages and seconds
    } else if (lastDate && getDaysDifference(lastDate, today) === 1 && today > lastDate) {
      // Consecutive day: advance streak
      newCurrentStreak += 1;
      newLongestStreak = Math.max(newLongestStreak, newCurrentStreak);
    } else {
      // Broken streak: reset to 1
      newCurrentStreak = 1;
    }

    const newPages = (existing.total_pages_read || 0) + pagesRead;
    const newSeconds = (existing.total_reading_seconds || 0) + durationSeconds;

    const updateStmt = this.db.prepare(`
      UPDATE user_reading_streaks
      SET current_streak = ?,
          longest_streak = ?,
          last_read_date = ?,
          total_pages_read = ?,
          total_reading_seconds = ?,
          updated_at = datetime('now')
      WHERE user_id = ?
    `);
    updateStmt.run(newCurrentStreak, newLongestStreak, today, newPages, newSeconds, userId);

    return {
      userId,
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastReadDate: today,
      totalPagesRead: newPages,
      totalReadingSeconds: newSeconds,
      totalReadingMinutes: Math.round(newSeconds / 60),
      isStreakActiveToday: true,
      flameLevel: calculateFlameLevel(newCurrentStreak),
    };
  }

  public getStreak(userId = 'local_user', currentDate?: string): ReadingStreakResult {
    const today = currentDate || new Date().toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      SELECT user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds
      FROM user_reading_streaks
      WHERE user_id = ?
    `);

    const row = stmt.get(userId) as any;

    if (!row) {
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastReadDate: null,
        totalPagesRead: 0,
        totalReadingSeconds: 0,
        totalReadingMinutes: 0,
        isStreakActiveToday: false,
        flameLevel: 0,
      };
    }

    const lastDate = row.last_read_date;
    const isToday = lastDate === today;
    const isYesterday = lastDate && getDaysDifference(lastDate, today) === 1 && today > lastDate;

    // If more than 1 day has elapsed, current active streak is 0 until user reads today
    const activeStreak = isToday || isYesterday ? row.current_streak : 0;

    return {
      userId: row.user_id,
      currentStreak: activeStreak,
      longestStreak: row.longest_streak,
      lastReadDate: row.last_read_date,
      totalPagesRead: row.total_pages_read || 0,
      totalReadingSeconds: row.total_reading_seconds || 0,
      totalReadingMinutes: Math.round((row.total_reading_seconds || 0) / 60),
      isStreakActiveToday: isToday,
      flameLevel: calculateFlameLevel(activeStreak),
    };
  }
}
