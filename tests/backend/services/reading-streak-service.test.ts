import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { ReadingStreakService } from '../../../src/backend/services/reading-streak-service.js';

describe('ReadingStreakService', () => {
  let db: DatabaseInstance;
  let service: ReadingStreakService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new ReadingStreakService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('records initial reading activity and starts a 1-day streak', () => {
    const res = service.recordActivity('user_1', 15, 300, '2026-11-01');

    expect(res.userId).toBe('user_1');
    expect(res.currentStreak).toBe(1);
    expect(res.longestStreak).toBe(1);
    expect(res.totalPagesRead).toBe(15);
    expect(res.totalReadingSeconds).toBe(300);
    expect(res.totalReadingMinutes).toBe(5);
    expect(res.isStreakActiveToday).toBe(true);
    expect(res.flameLevel).toBe(1);
  });

  it('accumulates pages and time on the same day without inflating streak count', () => {
    service.recordActivity('user_1', 10, 200, '2026-11-01');
    const second = service.recordActivity('user_1', 12, 180, '2026-11-01');

    expect(second.currentStreak).toBe(1);
    expect(second.longestStreak).toBe(1);
    expect(second.totalPagesRead).toBe(22);
    expect(second.totalReadingSeconds).toBe(380);
  });

  it('advances streak on consecutive days and updates longest streak', () => {
    service.recordActivity('user_1', 10, 200, '2026-11-01');
    const day2 = service.recordActivity('user_1', 15, 300, '2026-11-02');
    const day3 = service.recordActivity('user_1', 20, 400, '2026-11-03');

    expect(day2.currentStreak).toBe(2);
    expect(day2.longestStreak).toBe(2);

    expect(day3.currentStreak).toBe(3);
    expect(day3.longestStreak).toBe(3);
    expect(day3.flameLevel).toBe(2); // 3+ days triggers flame level 2
  });

  it('resets current streak to 1 after an inactivity gap while preserving longest streak', () => {
    service.recordActivity('user_1', 10, 200, '2026-11-01');
    service.recordActivity('user_1', 10, 200, '2026-11-02');
    service.recordActivity('user_1', 10, 200, '2026-11-03'); // 3 day streak

    // Inactivity gap: skipped 2026-11-04, resumes on 2026-11-05
    const gapResume = service.recordActivity('user_1', 5, 100, '2026-11-05');

    expect(gapResume.currentStreak).toBe(1);
    expect(gapResume.longestStreak).toBe(3); // Preserves previous record
  });

  it('returns empty streak status for new users without reading activity', () => {
    const empty = service.getStreak('non_existent_user', '2026-11-01');

    expect(empty.currentStreak).toBe(0);
    expect(empty.longestStreak).toBe(0);
    expect(empty.totalPagesRead).toBe(0);
    expect(empty.isStreakActiveToday).toBe(false);
    expect(empty.flameLevel).toBe(0);
  });

  it('reports active streak when queried today or yesterday', () => {
    service.recordActivity('user_1', 10, 200, '2026-11-01');

    // Query on same day
    const queryToday = service.getStreak('user_1', '2026-11-01');
    expect(queryToday.currentStreak).toBe(1);
    expect(queryToday.isStreakActiveToday).toBe(true);

    // Query on next day before reading (streak is still intact from yesterday)
    const queryNextDay = service.getStreak('user_1', '2026-11-02');
    expect(queryNextDay.currentStreak).toBe(1);
    expect(queryNextDay.isStreakActiveToday).toBe(false);

    // Query 2 days later without reading (streak lapsed)
    const queryLapsed = service.getStreak('user_1', '2026-11-03');
    expect(queryLapsed.currentStreak).toBe(0);
  });
});
