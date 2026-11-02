import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository.js';

describe('Stats Analytics Fastify Routes (Sprint 41)', () => {
  let app: any;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    const chapRepo = new ChapterRepository(db);

    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 'spy-x-family', 'Spy x Family', 'manga', 'ongoing');

      INSERT INTO genres (id, name, slug)
      VALUES (1, 'Action', 'action'),
             (2, 'Comedy', 'comedy');

      INSERT INTO series_genres (series_id, genre_id)
      VALUES ('s1', 1),
             ('s1', 2);
    `);

    chapRepo.createChapter({
      id: 'c1',
      seriesId: 's1',
      chapterNumber: 1,
      storagePath: 'series/spy-x-family/c1',
    });

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/analytics/stats-radar returns default empty structure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/stats-radar?userId=fresh_user',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe('fresh_user');
    expect(body.totalGenresTracked).toBe(0);
    expect(body.axes).toEqual([]);
  });

  it('POST /api/v1/analytics/record-read records chapter and updates radar and heatmap', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/record-read',
      payload: {
        userId: 'test_user_1',
        chapterId: 'c1',
        readingSeconds: 180,
      },
    });

    expect(postRes.statusCode).toBe(200);
    expect(postRes.json().success).toBe(true);

    // Verify Radar Stats
    const radarRes = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/stats-radar?userId=test_user_1',
    });

    expect(radarRes.statusCode).toBe(200);
    const radarData = radarRes.json();
    expect(radarData.totalGenresTracked).toBe(2);
    expect(radarData.axes.length).toBe(2);
    expect(radarData.axes[0].score).toBe(100);

    // Verify Heatmap
    const heatRes = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/activity-heatmap?userId=test_user_1&daysBack=7',
    });

    expect(heatRes.statusCode).toBe(200);
    const heatData = heatRes.json();
    expect(heatData.totalPagesPeriod).toBeGreaterThan(0);
    expect(heatData.days.length).toBe(8);
  });

  it('POST /api/v1/analytics/record-read rejects missing chapterId with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/record-read',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Bad Request');
  });
});
