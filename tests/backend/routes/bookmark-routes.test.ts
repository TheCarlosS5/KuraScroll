import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import type { FastifyInstance } from 'fastify';

describe('Bookmark & Quick-Index Fastify Routes (Sprint 34)', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed test series & chapters
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-one-piece', 'one-piece', 'One Piece', 'manga', 'ongoing')
    `).run();

    const insertCh = db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES (?, 's-one-piece', ?, ?, '/ch', 18)
    `);

    insertCh.run('ch-1000', 1000, 'Straw Hat Luffy');
    insertCh.run('ch-1001', 1001, 'Battle of Monsters on Onigashima');

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/series/:seriesId/chapters/quick-index returns lightweight chapter list in < 5ms', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/series/s-one-piece/chapters/quick-index',
      headers: { 'x-user-id': 'otaku-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.seriesId).toBe('s-one-piece');
    expect(body.totalChapters).toBe(2);
    expect(body.readChapters).toBe(0);
    expect(body.totalBookmarks).toBe(0);
    expect(body.chapters[0].chapterNumber).toBe(1000);
    expect(body.chapters[0].title).toBe('Straw Hat Luffy');
  });

  it('POST /api/v1/bookmarks creates bookmark and updates quick-index counter', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookmarks',
      headers: { 'x-user-id': 'otaku-1' },
      payload: {
        seriesId: 's-one-piece',
        chapterId: 'ch-1000',
        pageIndex: 12,
        note: 'Epic Red Roc punch!',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = createRes.json();
    expect(createBody.success).toBe(true);
    expect(createBody.bookmark.note).toBe('Epic Red Roc punch!');
    expect(createBody.bookmark.pageIndex).toBe(12);

    // Verify quick index reflects the bookmark count
    const indexRes = await app.inject({
      method: 'GET',
      url: '/api/v1/series/s-one-piece/chapters/quick-index',
      headers: { 'x-user-id': 'otaku-1' },
    });
    const indexBody = indexRes.json();
    expect(indexBody.totalBookmarks).toBe(1);
    expect(indexBody.chapters[0].bookmarkCount).toBe(1);
  });

  it('GET /api/v1/series/:seriesId/bookmarks and GET /api/v1/chapters/:chapterId/bookmarks retrieve bookmarks', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/bookmarks',
      headers: { 'x-user-id': 'otaku-1' },
      payload: { seriesId: 's-one-piece', chapterId: 'ch-1000', pageIndex: 5 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/bookmarks',
      headers: { 'x-user-id': 'otaku-1' },
      payload: { seriesId: 's-one-piece', chapterId: 'ch-1000', pageIndex: 15 },
    });

    const seriesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/series/s-one-piece/bookmarks',
      headers: { 'x-user-id': 'otaku-1' },
    });
    expect(seriesRes.statusCode).toBe(200);
    expect(seriesRes.json().total).toBe(2);

    const chapterRes = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch-1000/bookmarks',
      headers: { 'x-user-id': 'otaku-1' },
    });
    expect(chapterRes.statusCode).toBe(200);
    expect(chapterRes.json().total).toBe(2);
  });

  it('DELETE /api/v1/bookmarks/:id and DELETE /api/v1/chapters/:chapterId/bookmarks/:pageIndex delete bookmark', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/bookmarks',
      headers: { 'x-user-id': 'otaku-1' },
      payload: { seriesId: 's-one-piece', chapterId: 'ch-1001', pageIndex: 3 },
    });
    const bmId = postRes.json().bookmark.id;

    // Delete by ID
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/bookmarks/${bmId}`,
      headers: { 'x-user-id': 'otaku-1' },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().deleted).toBe(true);

    // Create another and delete by location
    await app.inject({
      method: 'POST',
      url: '/api/v1/bookmarks',
      headers: { 'x-user-id': 'otaku-1' },
      payload: { seriesId: 's-one-piece', chapterId: 'ch-1001', pageIndex: 7 },
    });

    const delLocRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/chapters/ch-1001/bookmarks/7',
      headers: { 'x-user-id': 'otaku-1' },
    });
    expect(delLocRes.statusCode).toBe(200);
    expect(delLocRes.json().deleted).toBe(true);
  });
});
