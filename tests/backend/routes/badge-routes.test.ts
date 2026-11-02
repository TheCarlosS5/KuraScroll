import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Sprint 31: Badge Fastify Routes & Subsystem', () => {
  let app: any;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    app = buildApp({ db, storageRoot: './tmp' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/badges returns all 12 catalog badges with initial zero progress', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/badges?userId=newbie',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.badges.length).toBeGreaterThanOrEqual(12);
    expect(body.summary.unlocked).toBe(0);
    expect(body.summary.total).toBeGreaterThanOrEqual(12);
  });

  it('POST /api/v1/badges/evaluate unlocks badges based on reading streaks', async () => {
    // Seed user reading streaks
    db.prepare(`
      INSERT INTO user_reading_streaks (
        user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run('achiever', 7, 7, '2026-11-02', 250, 5000);

    const evalRes = await app.inject({
      method: 'POST',
      url: '/api/v1/badges/evaluate',
      payload: { userId: 'achiever' },
    });

    expect(evalRes.statusCode).toBe(200);
    const evalBody = JSON.parse(evalRes.body);
    expect(evalBody.success).toBe(true);
    expect(evalBody.newlyUnlocked.length).toBeGreaterThanOrEqual(3);

    // Verify unnotified badges endpoint returns the newly unlocked badges
    const unnotifiedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/badges/unnotified?userId=achiever',
    });
    expect(unnotifiedRes.statusCode).toBe(200);
    const unnotifiedBody = JSON.parse(unnotifiedRes.body);
    expect(unnotifiedBody.unnotified.length).toBe(evalBody.newlyUnlocked.length);

    // Dismiss unnotified badges
    const badgeIds = evalBody.newlyUnlocked.map((b: any) => b.id);
    const dismissRes = await app.inject({
      method: 'POST',
      url: '/api/v1/badges/notified',
      payload: { userId: 'achiever', badgeIds },
    });
    expect(dismissRes.statusCode).toBe(200);

    // Unnotified list should now be empty
    const emptyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/badges/unnotified?userId=achiever',
    });
    expect(JSON.parse(emptyRes.body).unnotified.length).toBe(0);
  });

  it('GET /api/v1/telemetry/badges returns subsystem telemetry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/telemetry/badges?userId=achiever',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.telemetry).toBeDefined();
    expect(body.telemetry.total_catalog_badges).toBeGreaterThanOrEqual(12);
  });
});
