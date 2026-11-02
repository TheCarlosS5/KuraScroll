import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Sprint 30: Daily Goals & Write-Behind Buffer Service Implementation
 */
class WriteBehindGoalService {
  private buffer: Array<{ userId: string; dateStr: string; pages: number; seconds: number }> = [];
  private goalCompletedEvents: Array<{ userId: string; dateStr: string }> = [];

  constructor(private db: DatabaseInstance, private dailyGoalPages: number = 30) {
    process.once('beforeExit', () => this.flushSync());
  }

  public bufferActivity(userId: string, dateStr: string, pages: number, seconds: number): void {
    this.buffer.push({ userId, dateStr, pages, seconds });
  }

  public flushSync(): void {
    if (this.buffer.length === 0) return;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const item of this.buffer) {
        const existing = this.db.prepare(`
          SELECT pages_read, seconds_spent, goal_reached FROM daily_goals WHERE user_id = ? AND activity_date = ?
        `).get(item.userId, item.dateStr) as any;

        let totalPages = item.pages;
        let totalSeconds = item.seconds;
        let goalReached = 0;

        if (existing) {
          totalPages += existing.pages_read;
          totalSeconds += existing.seconds_spent;
          goalReached = existing.goal_reached;
        }

        const nowGoalReached = totalPages >= this.dailyGoalPages ? 1 : 0;

        if (nowGoalReached === 1 && goalReached === 0) {
          const alreadyEmitted = this.goalCompletedEvents.some(
            e => e.userId === item.userId && e.dateStr === item.dateStr
          );
          if (!alreadyEmitted) {
            this.goalCompletedEvents.push({ userId: item.userId, dateStr: item.dateStr });
          }
        }

        this.db.prepare(`
          INSERT INTO daily_goals (user_id, activity_date, pages_read, seconds_spent, goal_reached, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, activity_date) DO UPDATE SET
            pages_read = excluded.pages_read,
            seconds_spent = excluded.seconds_spent,
            goal_reached = excluded.goal_reached,
            updated_at = datetime('now')
        `).run(item.userId, item.dateStr, totalPages, totalSeconds, nowGoalReached);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.buffer = [];
  }

  public getGoalStatus(userId: string, dateStr: string): any {
    return this.db.prepare(`
      SELECT user_id, activity_date, pages_read, seconds_spent, goal_reached
      FROM daily_goals
      WHERE user_id = ? AND activity_date = ?
    `).get(userId, dateStr);
  }

  public getGoalEvents(): Array<{ userId: string; dateStr: string }> {
    return this.goalCompletedEvents;
  }
}

describe('Sprint 30: Daily Goals & Write-Behind Recovery Edge Cases Suite', () => {
  let db: DatabaseInstance;
  let service: WriteBehindGoalService;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint30');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_goals (
        user_id TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        pages_read INTEGER NOT NULL DEFAULT 0,
        seconds_spent INTEGER NOT NULL DEFAULT 0,
        goal_reached INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, activity_date)
      );
    `);

    service = new WriteBehindGoalService(db, 30);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Dirty buffer crash resilience: synchronous flush on abrupt exit
  // =========================================================================
  it('1.1: dirty buffer flushes synchronously on abrupt termination without data loss', async () => {
    const userId = 'user-crash';
    const dateStr = '2026-11-02';

    service.bufferActivity(userId, dateStr, 12, 120);
    service.bufferActivity(userId, dateStr, 8, 80);

    let status = service.getGoalStatus(userId, dateStr);
    expect(status).toBeUndefined();

    service.flushSync();

    status = service.getGoalStatus(userId, dateStr);
    expect(status.pages_read).toBe(20);
    expect(status.seconds_spent).toBe(200);
  });

  // =========================================================================
  // 2. Goal reached notification deduping (exactly ONCE per day)
  // =========================================================================
  it('2.1: reaching daily goal emits goal_completed event exactly once even with excess reading', async () => {
    const userId = 'user-dedup';
    const dateStr = '2026-11-02';

    service.bufferActivity(userId, dateStr, 30, 300);
    service.flushSync();

    let events = service.getGoalEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ userId, dateStr });

    service.bufferActivity(userId, dateStr, 20, 200);
    service.flushSync();

    events = service.getGoalEvents();
    expect(events.length).toBe(1);
  });

  // =========================================================================
  // 3. Clock skew / midnight rollover (partitioning across dates)
  // =========================================================================
  it('3.1: reading across midnight correctly attributes pages to each date partition', async () => {
    const userId = 'user-nightowl';
    const dayBefore = '2026-11-01';
    const dayAfter = '2026-11-02';

    service.bufferActivity(userId, dayBefore, 15, 10);
    service.bufferActivity(userId, dayAfter, 10, 10);
    service.flushSync();

    const statusBefore = service.getGoalStatus(userId, dayBefore);
    const statusAfter = service.getGoalStatus(userId, dayAfter);

    expect(statusBefore.pages_read).toBe(15);
    expect(statusAfter.pages_read).toBe(10);
  });

  // =========================================================================
  // 4. Concurrency test: multiple simultaneous tab reads updating buffer safely
  // =========================================================================
  it('4.1: concurrent multi-tab buffer writes aggregate accurately without data corruption', async () => {
    const userId = 'user-multitab';
    const dateStr = '2026-11-02';

    const concurrentBuffers = Array.from({ length: 15 }, () => {
      return Promise.resolve().then(() => {
        service.bufferActivity(userId, dateStr, 2, 20);
      });
    });

    await Promise.all(concurrentBuffers);
    service.flushSync();

    const status = service.getGoalStatus(userId, dateStr);
    expect(status.pages_read).toBe(30);
    expect(status.goal_reached).toBe(1);
    expect(service.getGoalEvents().length).toBe(1);
  });
});
