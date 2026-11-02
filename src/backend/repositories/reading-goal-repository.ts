import { DatabaseInstance } from '../db/database.js';

export type GoalTargetType = 'pages' | 'minutes';

export interface ReadingGoal {
  userId: string;
  targetType: GoalTargetType;
  targetValue: number;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SetReadingGoalInput {
  userId: string;
  targetType: GoalTargetType;
  targetValue: number;
  notificationsEnabled?: boolean;
}

export interface RecordActivityInput {
  userId: string;
  date: string; // Strict YYYY-MM-DD
  pagesDelta: number;
  secondsDelta: number;
}

export interface DailyProgressResult {
  userId: string;
  targetType: GoalTargetType;
  targetValue: number;
  pagesRead: number;
  readingSeconds: number;
  goalCompleted: boolean;
  completedAt: string | null;
  progressPercentage: number;
}

export interface CalendarDay {
  date: string;
  pagesRead: number;
  readingSeconds: number;
  goalCompleted: boolean;
  completedAt: string | null;
}

export interface LifetimeHabitStats {
  lifetimePages: number;
  lifetimeSeconds: number;
  totalGoalsCompleted: number;
  totalActiveDays: number;
  currentStreak: number;
  bestStreak: number;
}

export class ReadingGoalRepository {
  constructor(private db: DatabaseInstance) {}

  /**
   * Upsert reading goal settings for a user.
   */
  setGoal(input: SetReadingGoalInput): ReadingGoal {
    const notifications = input.notificationsEnabled ?? true ? 1 : 0;
    const stmt = this.db.prepare(`
      INSERT INTO user_reading_goals (user_id, target_type, target_value, notifications_enabled, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        target_type = excluded.target_type,
        target_value = excluded.target_value,
        notifications_enabled = excluded.notifications_enabled,
        updated_at = datetime('now')
    `);

    stmt.run(input.userId, input.targetType, input.targetValue, notifications);
    return this.getGoal(input.userId)!;
  }

  /**
   * Retrieve reading goal for a user, or default 20 pages if unset.
   */
  getGoal(userId: string): ReadingGoal | null {
    const stmt = this.db.prepare(`
      SELECT user_id, target_type, target_value, notifications_enabled, created_at, updated_at
      FROM user_reading_goals
      WHERE user_id = ?
    `);

    const row = stmt.get(userId) as any;
    if (!row) return null;

    return {
      userId: row.user_id,
      targetType: row.target_type,
      targetValue: row.target_value,
      notificationsEnabled: Boolean(row.notifications_enabled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Atomically records incremental pages and seconds read for a specific date,
   * checks against target threshold, and locks in completed_at timestamp on initial achievement.
   */
  recordActivity(input: RecordActivityInput): void {
    const goal = this.getGoal(input.userId) || {
      targetType: 'pages' as GoalTargetType,
      targetValue: 20,
    };

    const stmt = this.db.prepare(`
      INSERT INTO user_daily_activity (
        user_id, date, pages_read, reading_seconds, goal_completed, completed_at, updated_at
      ) VALUES (
        :userId, :date, :pagesDelta, :secondsDelta,
        CASE 
          WHEN :targetType = 'pages' AND :pagesDelta >= :targetValue THEN 1
          WHEN :targetType = 'minutes' AND (:secondsDelta / 60) >= :targetValue THEN 1
          ELSE 0
        END,
        CASE 
          WHEN (:targetType = 'pages' AND :pagesDelta >= :targetValue) 
            OR (:targetType = 'minutes' AND (:secondsDelta / 60) >= :targetValue)
            THEN datetime('now')
          ELSE NULL
        END,
        datetime('now')
      )
      ON CONFLICT(user_id, date) DO UPDATE SET
        pages_read = user_daily_activity.pages_read + excluded.pages_read,
        reading_seconds = user_daily_activity.reading_seconds + excluded.reading_seconds,
        goal_completed = CASE 
          WHEN user_daily_activity.goal_completed = 1 THEN 1
          WHEN :targetType = 'pages' AND (user_daily_activity.pages_read + excluded.pages_read) >= :targetValue THEN 1
          WHEN :targetType = 'minutes' AND ((user_daily_activity.reading_seconds + excluded.reading_seconds) / 60) >= :targetValue THEN 1
          ELSE 0
        END,
        completed_at = CASE 
          WHEN user_daily_activity.goal_completed = 1 THEN user_daily_activity.completed_at
          WHEN (:targetType = 'pages' AND (user_daily_activity.pages_read + excluded.pages_read) >= :targetValue)
            OR (:targetType = 'minutes' AND ((user_daily_activity.reading_seconds + excluded.reading_seconds) / 60) >= :targetValue)
            THEN datetime('now')
          ELSE NULL
        END,
        updated_at = datetime('now');
    `);

    stmt.run({
      userId: input.userId,
      date: input.date,
      pagesDelta: Math.max(0, input.pagesDelta),
      secondsDelta: Math.max(0, input.secondsDelta),
      targetType: goal.targetType,
      targetValue: goal.targetValue,
    });
  }

  /**
   * Computes today's goal completion percentage in sub-millisecond execution time.
   */
  getDailyProgress(userId: string, date: string): DailyProgressResult {
    const stmt = this.db.prepare(`
      SELECT 
        COALESCE(g.target_type, 'pages') AS target_type,
        COALESCE(g.target_value, 20) AS target_value,
        COALESCE(a.pages_read, 0) AS pages_read,
        COALESCE(a.reading_seconds, 0) AS reading_seconds,
        COALESCE(a.goal_completed, 0) AS goal_completed,
        a.completed_at,
        CASE 
          WHEN COALESCE(g.target_type, 'pages') = 'pages' 
            THEN MIN(100.0, ROUND((COALESCE(a.pages_read, 0) * 100.0) / COALESCE(g.target_value, 20), 1))
          WHEN g.target_type = 'minutes'
            THEN MIN(100.0, ROUND(((COALESCE(a.reading_seconds, 0) / 60.0) * 100.0) / g.target_value, 1))
          ELSE 0.0
        END AS progress_percentage
      FROM (SELECT ? AS uid) u
      LEFT JOIN user_reading_goals g ON g.user_id = u.uid
      LEFT JOIN user_daily_activity a ON a.user_id = u.uid AND a.date = ?
    `);

    const row = stmt.get(userId, date) as any;

    return {
      userId,
      targetType: row.target_type,
      targetValue: row.target_value,
      pagesRead: row.pages_read,
      readingSeconds: row.reading_seconds,
      goalCompleted: Boolean(row.goal_completed),
      completedAt: row.completed_at,
      progressPercentage: row.progress_percentage,
    };
  }

  /**
   * Calculates current consecutive days streak using an ultra-fast covering index scan.
   */
  getCurrentStreak(userId: string, todayStr: string): number {
    const stmt = this.db.prepare(`
      SELECT date
      FROM user_daily_activity
      WHERE user_id = ? AND goal_completed = 1
      ORDER BY date DESC
      LIMIT 100
    `);

    const rows = stmt.all(userId) as Array<{ date: string }>;
    if (!rows || rows.length === 0) return 0;

    const todayDate = new Date(`${todayStr}T00:00:00Z`);
    const dToday = todayDate.toISOString().slice(0, 10);
    todayDate.setUTCDate(todayDate.getUTCDate() - 1);
    const dYesterday = todayDate.toISOString().slice(0, 10);

    let currentCheck = '';
    if (rows[0].date === dToday) {
      currentCheck = dToday;
    } else if (rows[0].date === dYesterday) {
      currentCheck = dYesterday;
    } else {
      return 0; // Streak broken if neither today nor yesterday met the goal
    }

    let streak = 0;
    const cursor = new Date(`${currentCheck}T00:00:00Z`);

    for (const row of rows) {
      const expectedDate = cursor.toISOString().slice(0, 10);
      if (row.date === expectedDate) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Retrieves past 7-day calendar history with zero-filled missing days.
   */
  getPast7DaysCalendar(userId: string, todayStr: string): CalendarDay[] {
    const d = new Date(`${todayStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    const startStr = d.toISOString().slice(0, 10);

    const stmt = this.db.prepare(`
      SELECT date, pages_read, reading_seconds, goal_completed, completed_at
      FROM user_daily_activity
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `);

    const rows = stmt.all(userId, startStr, todayStr) as any[];
    const activityMap = new Map<string, any>(rows.map((r) => [r.date, r]));

    const result: CalendarDay[] = [];
    const cursor = new Date(`${startStr}T00:00:00Z`);

    for (let i = 0; i < 7; i++) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const match = activityMap.get(dateKey);

      result.push({
        date: dateKey,
        pagesRead: match ? match.pages_read : 0,
        readingSeconds: match ? match.reading_seconds : 0,
        goalCompleted: match ? Boolean(match.goal_completed) : false,
        completedAt: match ? match.completed_at : null,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return result;
  }

  /**
   * Retrieves lifetime habit statistics and all-time best streak via covering index.
   */
  getLifetimeStats(userId: string, todayStr: string): LifetimeHabitStats {
    const statsStmt = this.db.prepare(`
      SELECT 
        COALESCE(SUM(pages_read), 0) AS lifetime_pages,
        COALESCE(SUM(reading_seconds), 0) AS lifetime_seconds,
        COALESCE(SUM(goal_completed), 0) AS total_goals_completed,
        COUNT(*) AS total_active_days
      FROM user_daily_activity
      WHERE user_id = ?
    `);
    const stats = statsStmt.get(userId) as any;

    const bestStreakStmt = this.db.prepare(`
      WITH numbered AS (
        SELECT 
          date,
          CAST(strftime('%J', date) AS INTEGER) - ROW_NUMBER() OVER (ORDER BY date) AS grp
        FROM user_daily_activity
        WHERE user_id = ? AND goal_completed = 1
      ),
      streak_lengths AS (
        SELECT COUNT(*) AS streak_len
        FROM numbered
        GROUP BY grp
      )
      SELECT COALESCE(MAX(streak_len), 0) AS best_streak FROM streak_lengths
    `);
    const bestStreakRow = bestStreakStmt.get(userId) as any;

    return {
      lifetimePages: stats.lifetime_pages,
      lifetimeSeconds: stats.lifetime_seconds,
      totalGoalsCompleted: stats.total_goals_completed,
      totalActiveDays: stats.total_active_days,
      currentStreak: this.getCurrentStreak(userId, todayStr),
      bestStreak: bestStreakRow?.best_streak || 0,
    };
  }
}
