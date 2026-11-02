import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Analytics & Reading Streak Fastify Routes', () => {
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

  it('GET /api/v1/analytics/streak returns 0 streak for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/streak?userId=brand_new_reader',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.streak.currentStreak).toBe(0);
    expect(body.streak.isStreakActiveToday).toBe(false);
  });

  it('POST /api/v1/analytics/activity records pages and reading duration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/activity',
      payload: {
        userId: 'carlos_reader',
        pagesRead: 25,
        durationSeconds: 450,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.streak.currentStreak).toBe(1);
    expect(body.streak.totalPagesRead).toBe(25);
    expect(body.streak.totalReadingMinutes).toBe(8);
  });

  it('POST /api/v1/progress automatically updates user reading streak', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s1', 'one-piece', 'One Piece', 'manga', 'ongoing');
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES ('c1', 's1', 1100, 'path/1100');
    `);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/progress',
      payload: {
        userId: 'carlos_reader',
        seriesId: 's1',
        chapterId: 'c1',
        pageNumber: 15,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.streak).toBeDefined();
    expect(body.streak.currentStreak).toBeGreaterThanOrEqual(1);

    // Verify streak query reflects progress update
    const streakRes = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/streak?userId=carlos_reader',
    });
    expect(streakRes.statusCode).toBe(200);
    expect(JSON.parse(streakRes.body).streak.currentStreak).toBeGreaterThanOrEqual(1);
  });

  it('GET and PUT /api/v1/analytics/goals customizes targets and computes daily progress', async () => {
    // 1. Initial GET
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/goals?userId=carlos_goal',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.success).toBe(true);
    expect(getBody.goal.targetValue).toBe(30);

    // 2. PUT custom goal (40 pages/day)
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/analytics/goals',
      payload: {
        userId: 'carlos_goal',
        targetType: 'pages',
        targetValue: 40,
        notificationsEnabled: true,
      },
    });
    expect(putRes.statusCode).toBe(200);
    const putBody = JSON.parse(putRes.body);
    expect(putBody.goal.targetValue).toBe(40);

    // 3. Reject invalid targetType
    const badRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/analytics/goals',
      payload: {
        userId: 'carlos_goal',
        targetType: 'invalid_type',
        targetValue: 40,
      },
    });
    expect(badRes.statusCode).toBe(400);
  });

  it('POST /api/v1/analytics/activity/buffered and GET /api/v1/telemetry/buffer', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/activity/buffered',
      payload: {
        userId: 'carlos_buffered',
        pagesDelta: 10,
        secondsDelta: 120,
        flushNow: true,
      },
    });
    expect(postRes.statusCode).toBe(200);
    const postBody = JSON.parse(postRes.body);
    expect(postBody.success).toBe(true);
    expect(postBody.buffered).toBe(true);

    const telemetryRes = await app.inject({
      method: 'GET',
      url: '/api/v1/telemetry/buffer',
    });
    expect(telemetryRes.statusCode).toBe(200);
    const telemetryBody = JSON.parse(telemetryRes.body);
    expect(telemetryBody.success).toBe(true);
    expect(telemetryBody.telemetry.totalBufferedWrites).toBeGreaterThanOrEqual(1);
  });
});
