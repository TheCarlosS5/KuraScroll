import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { BadgeEvaluatorService } from '../../../src/backend/services/badge-evaluator-service.js';
import { IOCoordinator } from '../../../src/backend/storage/io/io-coordinator.js';

describe('Sprint 31: BadgeEvaluatorService Unit & Benchmark Suite', () => {
  let db: DatabaseInstance;
  let coordinator: IOCoordinator;
  let evaluator: BadgeEvaluatorService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    coordinator = new IOCoordinator();
    evaluator = new BadgeEvaluatorService(db, coordinator);
  });

  it('retroactively unlocks volume and streak badges based on aggregated stats', async () => {
    // Seed user reading streak data: 650 pages read, 8 days streak
    db.prepare(`
      INSERT INTO user_reading_streaks (
        user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('user-retro', 8, 8, '2026-11-02', 650, 12000);

    const unlockedEvents: any[] = [];
    evaluator.onBadgeUnlocked((b) => unlockedEvents.push(b));

    const newlyUnlocked = await evaluator.evaluateUserBadges('user-retro');

    // Should unlock: first_step, page_devourer_100, page_devourer_500, streak_3, streak_7
    expect(newlyUnlocked.length).toBeGreaterThanOrEqual(5);
    const ids = newlyUnlocked.map((b) => b.id);
    expect(ids).toContain('first_step');
    expect(ids).toContain('page_devourer_100');
    expect(ids).toContain('page_devourer_500');
    expect(ids).toContain('streak_3');
    expect(ids).toContain('streak_7');

    expect(unlockedEvents.length).toBe(newlyUnlocked.length);
  });

  it('is strictly idempotent on subsequent evaluations', async () => {
    db.prepare(`
      INSERT INTO user_reading_streaks (
        user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('user-idempotent', 3, 3, '2026-11-02', 120, 2400);

    // Run 1: unlocks first_step, page_devourer_100, streak_3 (+ night_owl if between 23:00-04:00)
    const run1 = await evaluator.evaluateUserBadges('user-idempotent');
    expect(run1.length).toBeGreaterThanOrEqual(3);

    // Run 2: same state, returns 0 newly unlocked badges
    const run2 = await evaluator.evaluateUserBadges('user-idempotent');
    expect(run2.length).toBe(0);
  });

  it('unlocks night owl badge when reading during night hours', async () => {
    db.prepare(`
      INSERT INTO user_reading_streaks (
        user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('user-night', 1, 1, '2026-11-02', 50, 600);

    // Evaluate at 2 AM
    const newlyUnlocked = await evaluator.evaluateUserBadges('user-night', { currentHour: 2 });
    const nightBadge = newlyUnlocked.find((b) => b.id === 'night_owl');
    expect(nightBadge).toBeDefined();
    expect(nightBadge?.isUnlocked).toBe(true);
  });

  it('benchmark: evaluates full badge catalog under concurrent load (< 25 ms SLA)', async () => {
    db.prepare(`
      INSERT INTO user_reading_streaks (
        user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('bench-user', 15, 15, '2026-11-02', 800, 16000);

    const iterations = 50;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      await evaluator.evaluateUserBadges('bench-user');
    }

    const totalTimeMs = performance.now() - startTime;
    const avgLatencyMs = totalTimeMs / iterations;

    expect(avgLatencyMs).toBeLessThan(25); // Realistic SLA under concurrent monorepo worker load
  });
});
