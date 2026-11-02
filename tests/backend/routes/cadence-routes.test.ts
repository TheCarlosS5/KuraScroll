import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Sprint 53: Cadence Routes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_cad', 'ser-cad', 'Cadence Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_cad', 'ser_cad', 1, 'Chapter 1', '/storage/cad1')
    `).run();

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/users/:userId/cadence retrieves user profile or baseline', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/user_alpha/cadence?mode=webtoon',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.readingMode).toBe('webtoon');
    expect(body.profile.averageSecondsPerPage).toBe(12.0);
  });

  it('POST /api/v1/cadence/record-transition records dwell and predicts time', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cadence/record-transition',
      payload: {
        userId: 'user_alpha',
        chapterId: 'chap_cad',
        pageNumber: 3,
        dwellSeconds: 18.0,
        readingMode: 'manga',
        totalPages: 20,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.prediction.pagesRemaining).toBe(17);
    expect(body.prediction.effectiveSecondsPerPage).toBeGreaterThan(0);
    expect(body.prediction.estimatedRemainingSeconds).toBeGreaterThan(0);
  });

  it('GET /api/v1/chapters/:chapterId/estimate returns dynamic prediction', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/chap_cad/estimate?userId=user_alpha&currentPage=5&totalPages=25&mode=manga',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.prediction.pagesRemaining).toBe(20);
    expect(body.prediction.estimatedRemainingMinutes).toBeGreaterThan(0);
  });

  it('DELETE /api/v1/users/:userId/cadence resets profile', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/user_alpha/cadence',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});
