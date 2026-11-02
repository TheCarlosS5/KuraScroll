import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Deduplication & Merge Fastify Routes (Sprint 43)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/admin/dedup/candidates returns empty candidates when no duplicates exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dedup/candidates?threshold=0.85'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.count).toBe(0);
    expect(body.candidates).toEqual([]);
  });

  it('POST /api/v1/admin/dedup/merge validates required parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/dedup/merge',
      payload: { sourceSeriesId: 's-1' } // missing targetSeriesId
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Missing sourceSeriesId or targetSeriesId');
  });

  it('POST /api/v1/admin/dedup/merge performs merge and GET /api/v1/admin/dedup/history tracks it', async () => {
    // Insert series A and B
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES 
        ('s-1', 'bleach-scan', 'Bleach [Color]', 'manga', 'completed'),
        ('s-2', 'bleach-official', 'Bleach (Official)', 'manga', 'completed')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES ('ch-b-1', 's-1', 1, 20, '/manga/bleach/ch1')
    `).run();

    const mergeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/dedup/merge',
      payload: {
        sourceSeriesId: 's-1',
        targetSeriesId: 's-2'
      }
    });

    expect(mergeRes.statusCode).toBe(200);
    const mergeBody = JSON.parse(mergeRes.payload);
    expect(mergeBody.success).toBe(true);
    expect(mergeBody.chaptersMoved).toBe(1);

    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dedup/history'
    });

    expect(historyRes.statusCode).toBe(200);
    const historyBody = JSON.parse(historyRes.payload);
    expect(historyBody.count).toBe(1);
    expect(historyBody.history[0].sourceSeriesId).toBe('s-1');
    expect(historyBody.history[0].targetSeriesId).toBe('s-2');
  });
});
