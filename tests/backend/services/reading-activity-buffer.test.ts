import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { ReadingGoalRepository } from '../../../src/backend/repositories/reading-goal-repository.js';
import { ReadingActivityBuffer } from '../../../src/backend/services/reading-activity-buffer.js';
import { IOCoordinator } from '../../../src/backend/storage/io/io-coordinator.js';

describe('Sprint 30: ReadingActivityBuffer Unit & Stress Tests', () => {
  let db: DatabaseInstance;
  let repo: ReadingGoalRepository;
  let coordinator: IOCoordinator;
  let buffer: ReadingActivityBuffer;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new ReadingGoalRepository(db);
    coordinator = new IOCoordinator();
    buffer = new ReadingActivityBuffer(repo, coordinator, {
      flushIntervalMs: 50,
      flushThreshold: 10,
    });
  });

  afterEach(() => {
    buffer.dispose();
  });

  it('coalesces multiple rapid events for the same user and date into single pending entry', () => {
    buffer.recordActivity('user-1', '2026-11-02', 1, 10);
    buffer.recordActivity('user-1', '2026-11-02', 2, 20);
    buffer.recordActivity('user-1', '2026-11-02', 3, 30);

    expect(buffer.getPendingCount()).toBe(1);
    const telemetry = buffer.getTelemetry();
    expect(telemetry.dirtyEntriesCount).toBe(1);
    expect(telemetry.totalBufferedWrites).toBe(3);
  });

  it('triggers threshold flush when dirty entries reach flushThreshold', async () => {
    for (let i = 1; i <= 9; i++) {
      buffer.recordActivity(`user-${i}`, '2026-11-02', 1, 10);
    }
    expect(buffer.getPendingCount()).toBe(9);

    // 10th entry triggers threshold flush
    const triggered = buffer.recordActivity('user-10', '2026-11-02', 1, 10);
    expect(triggered).toBe(true);

    // Allow async coordinator flush to complete
    await new Promise((r) => setTimeout(r, 20));

    expect(buffer.getPendingCount()).toBe(0);
    const telemetry = buffer.getTelemetry();
    expect(telemetry.totalFlushes).toBeGreaterThanOrEqual(1);
  });

  it('flushes periodically via timer when items remain pending', async () => {
    buffer.recordActivity('user-timer', '2026-11-02', 5, 50);
    expect(buffer.getPendingCount()).toBe(1);

    // Wait for timer (flushIntervalMs = 50ms)
    await new Promise((r) => setTimeout(r, 80));

    expect(buffer.getPendingCount()).toBe(0);
    const progress = repo.getDailyProgress('user-timer', '2026-11-02');
    expect(progress.pagesRead).toBe(5);
    expect(progress.readingSeconds).toBe(50);
  });

  it('emits goal completed event exactly once when crossing target threshold', async () => {
    repo.setGoal({
      userId: 'user-streak',
      targetType: 'pages',
      targetValue: 20,
    });

    const goalEvents: any[] = [];
    buffer.onGoalCompleted((evt) => {
      goalEvents.push(evt);
    });

    // Step 1: Read 10 pages (not completed)
    buffer.recordActivity('user-streak', '2026-11-02', 10, 100);
    await buffer.flush();
    expect(goalEvents.length).toBe(0);

    // Step 2: Read another 15 pages (now 25 pages, goal reached!)
    buffer.recordActivity('user-streak', '2026-11-02', 15, 150);
    await buffer.flush();
    expect(goalEvents.length).toBe(1);
    expect(goalEvents[0].goalCompleted).toBe(true);
    expect(goalEvents[0].pagesRead).toBe(25);

    // Step 3: Read more pages (already completed, should NOT re-emit)
    buffer.recordActivity('user-streak', '2026-11-02', 10, 100);
    await buffer.flush();
    expect(goalEvents.length).toBe(1);
  });

  it('stress test: 150 rapid page flips with zero page loss and coalesced disk commits', async () => {
    repo.setGoal({
      userId: 'speed-reader',
      targetType: 'pages',
      targetValue: 100,
    });

    const totalEvents = 150;
    for (let i = 0; i < totalEvents; i++) {
      buffer.recordActivity('speed-reader', '2026-11-02', 1, 2);
    }

    // Flush any remaining
    await buffer.flush();

    const progress = repo.getDailyProgress('speed-reader', '2026-11-02');
    expect(progress.pagesRead).toBe(150);
    expect(progress.readingSeconds).toBe(300);
    expect(progress.goalCompleted).toBe(true);

    const telemetry = buffer.getTelemetry();
    expect(telemetry.totalBufferedWrites).toBe(150);
    // 150 events coalesced into the same key (1 entry in buffer), so flushes are tiny
    expect(telemetry.dirtyEntriesCount).toBe(0);
    expect(telemetry.averageFlushDurationMs).toBeLessThan(10);
  });

  it('reports warning alert in telemetry when alert thresholds are exceeded', () => {
    const smallBuffer = new ReadingActivityBuffer(repo, coordinator, {
      flushIntervalMs: 0, // disable auto timer
      maxDirtyCountWarning: 5,
    });

    for (let i = 0; i < 6; i++) {
      smallBuffer.recordActivity(`user-${i}`, '2026-11-02', 1, 5);
    }

    const telemetry = smallBuffer.getTelemetry();
    expect(telemetry.warningAlert).toBe(true);
    expect(telemetry.alertReason).toContain('Buffer backlog high');
    smallBuffer.dispose();
  });
});
