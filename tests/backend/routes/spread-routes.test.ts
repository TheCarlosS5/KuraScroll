import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Sprint 51: Spread Routes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed test series & chapter
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_test', 'ser-test', 'Test Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_101', 'ser_test', 101, 'Chapter 101', '/storage/chap101')
    `).run();

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/chapters/:chapterId/spread-detect batches manifests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/chap_101/spread-detect',
      payload: {
        readingDirection: 'rtl',
        pages: [
          { pageNumber: 1, width: 1000, height: 1440, isCover: true },
          { pageNumber: 2, width: 2400, height: 1800 },
          { pageNumber: 3, width: 1000, height: 1440 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.totalProcessed).toBe(3);
    expect(body.manifests[1].layoutDecision).toBe('split_spread');
    expect(body.manifests[1].segments).toHaveLength(2);
  });

  it('GET /api/v1/chapters/:chapterId/spread-manifest retrieves stored manifests', async () => {
    // Seed one page
    await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/chap_101/spread-detect',
      payload: {
        pages: [{ pageNumber: 42, width: 2400, height: 1800 }],
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/chap_101/spread-manifest',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.manifests[0].sourcePageNumber).toBe(42);
  });

  it('POST /api/v1/chapters/:chapterId/virtual-pages expands physical pages', async () => {
    // Seed double spread at page 2
    await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/chap_101/spread-detect',
      payload: {
        pages: [{ pageNumber: 2, width: 2400, height: 1800 }],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/chap_101/virtual-pages',
      payload: {
        readingDirection: 'rtl',
        physicalPages: [
          { pageNumber: 1, width: 1000, height: 1440 },
          { pageNumber: 2, width: 2400, height: 1800 },
          { pageNumber: 3, width: 1000, height: 1440 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.totalVirtual).toBe(4); // 1, 2-a, 2-b, 3
    expect(body.virtualPages[1].virtualKey).toBe('2-a');
    expect(body.virtualPages[2].virtualKey).toBe('2-b');
  });

  it('POST /api/v1/geometry/detect computes geometry in memory', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/geometry/detect',
      payload: {
        width: 2500,
        height: 1800,
        readingDirection: 'ltr',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.decision).toBe('split_spread');
    expect(body.result.segments[0].key).toBe('1-a');
    expect(body.result.segments[0].side).toBe('left'); // LTR: left first
  });
});
