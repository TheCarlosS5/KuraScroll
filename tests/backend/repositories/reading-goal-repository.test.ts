import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { ReadingGoalRepository } from '../../../src/backend/repositories/reading-goal-repository';

describe('ReadingGoalRepository (Daily Goals & Activity Habit Tracking)', () => {
  let db: DatabaseInstance;
  let repo: ReadingGoalRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new ReadingGoalRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('sets and retrieves reading goals for pages and minutes targets', () => {
    const goal1 = repo.setGoal({
      userId: 'user_1',
      targetType: 'pages',
      targetValue: 25,
      notificationsEnabled: true,
    });

    expect(goal1.targetType).toBe('pages');
    expect(goal1.targetValue).toBe(25);
    expect(goal1.notificationsEnabled).toBe(true);

    const fetched = repo.getGoal('user_1');
    expect(fetched?.targetValue).toBe(25);

    // Update goal to minutes
    const goal2 = repo.setGoal({
      userId: 'user_1',
      targetType: 'minutes',
      targetValue: 45,
      notificationsEnabled: false,
    });
    expect(goal2.targetType).toBe('minutes');
    expect(goal2.targetValue).toBe(45);
    expect(goal2.notificationsEnabled).toBe(false);
  });

  it('atomically records incremental activity and updates completion status & timestamp', () => {
    repo.setGoal({
      userId: 'user_2',
      targetType: 'pages',
      targetValue: 20,
    });

    // Step 1: Read 12 pages (< 20)
    repo.recordActivity({
      userId: 'user_2',
      date: '2026-11-02',
      pagesDelta: 12,
      secondsDelta: 720,
    });

    let progress = repo.getDailyProgress('user_2', '2026-11-02');
    expect(progress.pagesRead).toBe(12);
    expect(progress.readingSeconds).toBe(720);
    expect(progress.goalCompleted).toBe(false);
    expect(progress.completedAt).toBeNull();
    expect(progress.progressPercentage).toBe(60);

    // Step 2: Read 10 more pages (Total: 22 >= 20)
    repo.recordActivity({
      userId: 'user_2',
      date: '2026-11-02',
      pagesDelta: 10,
      secondsDelta: 600,
    });

    progress = repo.getDailyProgress('user_2', '2026-11-02');
    expect(progress.pagesRead).toBe(22);
    expect(progress.readingSeconds).toBe(1320);
    expect(progress.goalCompleted).toBe(true);
    expect(progress.completedAt).not.toBeNull();
    expect(progress.progressPercentage).toBe(100);
    const initialCompletedAt = progress.completedAt;

    // Step 3: Read additional 5 pages; completedAt must remain locked
    repo.recordActivity({
      userId: 'user_2',
      date: '2026-11-02',
      pagesDelta: 5,
      secondsDelta: 300,
    });

    progress = repo.getDailyProgress('user_2', '2026-11-02');
    expect(progress.pagesRead).toBe(27);
    expect(progress.goalCompleted).toBe(true);
    expect(progress.completedAt).toBe(initialCompletedAt);
  });

  it('calculates current active streak correctly when today is completed or pending', () => {
    repo.setGoal({
      userId: 'streak_user',
      targetType: 'pages',
      targetValue: 10,
    });

    // 5 consecutive days of completed goals ending yesterday
    const dates = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    for (const d of dates) {
      repo.recordActivity({
        userId: 'streak_user',
        date: d,
        pagesDelta: 15,
        secondsDelta: 900,
      });
    }

    // Today (2026-11-02) is not yet completed: streak should still be 5
    let streak = repo.getCurrentStreak('streak_user', '2026-11-02');
    expect(streak).toBe(5);

    // Complete today's goal: streak advances to 6
    repo.recordActivity({
      userId: 'streak_user',
      date: '2026-11-02',
      pagesDelta: 10,
      secondsDelta: 600,
    });

    streak = repo.getCurrentStreak('streak_user', '2026-11-02');
    expect(streak).toBe(6);

    // If 2 days elapse without reading (e.g. check on 2026-11-04): streak breaks to 0
    streak = repo.getCurrentStreak('streak_user', '2026-11-04');
    expect(streak).toBe(0);
  });

  it('generates a full 7-day calendar history with zero-filled missing days', () => {
    repo.recordActivity({
      userId: 'cal_user',
      date: '2026-10-27',
      pagesDelta: 10,
      secondsDelta: 600,
    });
    repo.recordActivity({
      userId: 'cal_user',
      date: '2026-10-30',
      pagesDelta: 20,
      secondsDelta: 1200,
    });

    const calendar = repo.getPast7DaysCalendar('cal_user', '2026-11-02');
    expect(calendar.length).toBe(7);
    expect(calendar[0].date).toBe('2026-10-27');
    expect(calendar[0].pagesRead).toBe(10);
    expect(calendar[3].date).toBe('2026-10-30');
    expect(calendar[3].pagesRead).toBe(20);

    // Inactive days are zero-filled
    expect(calendar[1].date).toBe('2026-10-28');
    expect(calendar[1].pagesRead).toBe(0);
    expect(calendar[6].date).toBe('2026-11-02');
    expect(calendar[6].pagesRead).toBe(0);
  });

  it('computes lifetime habit statistics and all-time best streak without full-table scans', () => {
    repo.setGoal({
      userId: 'lifetime_user',
      targetType: 'pages',
      targetValue: 10,
    });

    // Streak of 3 days
    ['2026-09-01', '2026-09-02', '2026-09-03'].forEach((d) => {
      repo.recordActivity({ userId: 'lifetime_user', date: d, pagesDelta: 15, secondsDelta: 900 });
    });

    // Gap, then a longer streak of 5 days
    ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'].forEach((d) => {
      repo.recordActivity({ userId: 'lifetime_user', date: d, pagesDelta: 20, secondsDelta: 1000 });
    });

    const stats = repo.getLifetimeStats('lifetime_user', '2026-09-14');
    expect(stats.totalActiveDays).toBe(8);
    expect(stats.totalGoalsCompleted).toBe(8);
    expect(stats.lifetimePages).toBe(3 * 15 + 5 * 20); // 145
    expect(stats.lifetimeSeconds).toBe(3 * 900 + 5 * 1000); // 7700
    expect(stats.bestStreak).toBe(5);
    expect(stats.currentStreak).toBe(5);
  });
});
