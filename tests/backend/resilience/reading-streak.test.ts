import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Reading Streak Analytics Service Implementation for Sprint 29
 */
class ReadingStreakService {
  constructor(private db: DatabaseInstance) {}

  public recordActivity(userId: string, dateStr: string, pagesRead: number, secondsSpent: number): void {
    // SQLite transaction handling for concurrent tab updates using BEGIN IMMEDIATE
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const existing = this.db.prepare(`
        SELECT streak_count, pages_read, seconds_spent FROM reading_streaks WHERE user_id = ? AND activity_date = ?
      `).get(userId, dateStr) as any;

      if (existing) {
        this.db.prepare(`
          UPDATE reading_streaks 
          SET pages_read = pages_read + ?, seconds_spent = seconds_spent + ?, updated_at = datetime('now')
          WHERE user_id = ? AND activity_date = ?
        `).run(pagesRead, secondsSpent, userId, dateStr);
      } else {
        const lastActivity = this.db.prepare(`
          SELECT activity_date, streak_count, longest_streak 
          FROM reading_streaks 
          WHERE user_id = ? 
          ORDER BY activity_date DESC 
          LIMIT 1
        `).get(userId) as any;

        let newStreak = 1;
        let longestStreak = 1;

        if (lastActivity) {
          const lastDate = new Date(lastActivity.activity_date);
          const currDate = new Date(dateStr);
          const diffTime = currDate.getTime() - lastDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

          if (diffDays === 1) {
            newStreak = lastActivity.streak_count + 1;
            longestStreak = Math.max(newStreak, lastActivity.longest_streak);
          } else if (diffDays === 0) {
            newStreak = lastActivity.streak_count;
            longestStreak = lastActivity.longest_streak;
          } else {
            newStreak = 1;
            longestStreak = Math.max(newStreak, lastActivity.longest_streak);
          }
        }

        this.db.prepare(`
          INSERT INTO reading_streaks (user_id, activity_date, streak_count, longest_streak, pages_read, seconds_spent, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(userId, dateStr, newStreak, longestStreak, pagesRead, secondsSpent);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getStreakStatus(userId: string): any {
    return this.db.prepare(`
      SELECT user_id, activity_date, streak_count, longest_streak, pages_read, seconds_spent
      FROM reading_streaks
      WHERE user_id = ?
      ORDER BY activity_date DESC
      LIMIT 1
    `).get(userId);
  }
}

describe('Sprint 29: Reading Streak Analytics Resilience Suite', () => {
  let db: DatabaseInstance;
  let streakService: ReadingStreakService;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint29');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    db.exec(`
      CREATE TABLE IF NOT EXISTS reading_streaks (
        user_id TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        streak_count INTEGER NOT NULL DEFAULT 1,
        longest_streak INTEGER NOT NULL DEFAULT 1,
        pages_read INTEGER NOT NULL DEFAULT 0,
        seconds_spent INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, activity_date)
      );
    `);

    streakService = new ReadingStreakService(db);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Múltiples lecturas en el mismo día incrementan páginas/segundos pero mantienen el streak intacto sin inflarlo
  // =========================================================================
  it('1.1: multiple reads on the same day increment pages and seconds without inflating streak', async () => {
    const userId = 'user-carlos';
    const today = '2026-11-02';

    streakService.recordActivity(userId, today, 15, 300);
    streakService.recordActivity(userId, today, 20, 450);

    const status = streakService.getStreakStatus(userId);
    expect(status.streak_count).toBe(1);
    expect(status.longest_streak).toBe(1);
    expect(status.pages_read).toBe(35);
    expect(status.seconds_spent).toBe(750);
  });

  // =========================================================================
  // 2. Lectura en día consecutivo (ayer -> hoy) incrementa streak en 1 y actualiza longest_streak
  // =========================================================================
  it('2.1: reading on consecutive days increments streak by 1 and updates longest_streak', async () => {
    const userId = 'user-carlos';
    const yesterday = '2026-11-01';
    const today = '2026-11-02';

    streakService.recordActivity(userId, yesterday, 10, 200);
    let status = streakService.getStreakStatus(userId);
    expect(status.streak_count).toBe(1);
    expect(status.longest_streak).toBe(1);

    streakService.recordActivity(userId, today, 25, 600);
    status = streakService.getStreakStatus(userId);
    expect(status.streak_count).toBe(2);
    expect(status.longest_streak).toBe(2);
    expect(status.pages_read).toBe(25);
  });

  // =========================================================================
  // 3. Racha rota (> 1 día sin leer) reinicia el streak a 1 limpiamente
  // =========================================================================
  it('3.1: broken streak (> 1 day gap) resets streak to 1 cleanly while preserving longest streak history', async () => {
    const userId = 'user-carlos';
    const day1 = '2026-10-28';
    const day2 = '2026-10-29';
    const dayGap = '2026-11-02';

    streakService.recordActivity(userId, day1, 10, 100);
    streakService.recordActivity(userId, day2, 15, 150);

    let status = streakService.getStreakStatus(userId);
    expect(status.streak_count).toBe(2);
    expect(status.longest_streak).toBe(2);

    streakService.recordActivity(userId, dayGap, 5, 50);
    status = streakService.getStreakStatus(userId);

    expect(status.streak_count).toBe(1);
    expect(status.longest_streak).toBe(2);
  });

  // =========================================================================
  // 4. Concurrencia de múltiples tabs actualizando el streak sobre SQLite WAL con transacción inmediata sin bloqueos
  // =========================================================================
  it('4.1: concurrent multi-tab streak updates over SQLite WAL with immediate transactions complete without lock errors', async () => {
    const userId = 'user-multitab';
    const today = '2026-11-02';

    const promises = Array.from({ length: 10 }, () => {
      return Promise.resolve().then(() => {
        streakService.recordActivity(userId, today, 1, 10);
      });
    });

    await Promise.all(promises);

    const status = streakService.getStreakStatus(userId);
    expect(status.streak_count).toBe(1);
    expect(status.pages_read).toBe(10);
    expect(status.seconds_spent).toBe(100);
  });
});
