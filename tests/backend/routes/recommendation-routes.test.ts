import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';

describe('Sprint 32: Recommendation & Velocity HTTP Endpoints', () => {
  let db: DatabaseInstance;
  let app: any;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed test series
    const insertSeries = db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status, cover_image)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertSeries.run('s1', 'solo-leveling', 'Solo Leveling', 'manhwa', 'completed', '/covers/sl.jpg');
    insertSeries.run('s2', 'berserk', 'Berserk', 'manga', 'ongoing', '/covers/berserk.jpg');

    app = buildApp({ db });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/recommendations/personalized returns fallback or personalized items with chapter times', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/recommendations/personalized?userId=test_user&limit=5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.recommendations).toBeDefined();
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.total).toBe(2);
    expect(body.recommendations[0].estimatedChapterMinutes).toBeGreaterThan(0);
  });

  it('GET /api/v1/analytics/reading-velocity returns default statistics for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/reading-velocity?userId=test_user&seriesId=s1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userId).toBe('test_user');
    expect(body.pagesPerMinute).toBeGreaterThan(0);
    expect(body.confidence).toBe('provisional');
  });

  it('POST /api/v1/analytics/velocity/sample accepts valid reading telemetry and updates EMA', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/velocity/sample',
      payload: {
        userId: 'test_user',
        seriesId: 's1',
        durationSeconds: 24.5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(true);
    expect(body.secondsPerPage).toBe(24.5);
    expect(body.pagesPerMinute).toBe(2.4);
  });

  it('POST /api/v1/analytics/velocity/sample gracefully rejects outlier durations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/velocity/sample',
      payload: {
        userId: 'test_user',
        seriesId: 's1',
        durationSeconds: 0.5, // Outlier: skimming < 1.5s
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(false);
  });
});
