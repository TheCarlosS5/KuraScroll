import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Sprint 52: Annotation Routes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_notes', 'ser-notes', 'Notes Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_ann', 'ser_notes', 1, 'Chapter 1', '/storage/ann1')
    `).run();

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/annotations creates an annotation successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/annotations',
      payload: {
        chapterId: 'chap_ann',
        pageNumber: 3,
        userId: 'reader_42',
        anchorX: 75.0,
        anchorY: 30.0,
        annotationType: 'panel_bookmark',
        contentText: 'Incredible action double page!',
        colorPreset: 'pink',
        isSpoiler: false,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.annotation.id).toBeGreaterThan(0);
    expect(body.annotation.chapterId).toBe('chap_ann');
    expect(body.annotation.annotationType).toBe('panel_bookmark');
    expect(body.annotation.colorPreset).toBe('pink');
  });

  it('POST /api/v1/annotations returns 400 for missing or invalid parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/annotations',
      payload: {
        chapterId: 'chap_ann',
        // missing pageNumber, userId, contentText
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Bad Request');
  });

  it('GET /api/v1/chapters/:chapterId/pages/:pageNumber/annotations retrieves page notes', async () => {
    // Create note
    await app.inject({
      method: 'POST',
      url: '/api/v1/annotations',
      payload: {
        chapterId: 'chap_ann',
        pageNumber: 7,
        userId: 'reader_1',
        anchorX: 12.0,
        anchorY: 45.0,
        contentText: 'Interesting background artifact',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/chap_ann/pages/7/annotations',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.annotations).toHaveLength(1);
    expect(body.annotations[0].contentText).toBe('Interesting background artifact');
  });

  it('GET /api/v1/chapters/:chapterId/annotations retrieves chapter overview', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/annotations',
      payload: {
        chapterId: 'chap_ann',
        pageNumber: 1,
        userId: 'reader_1',
        anchorX: 10,
        anchorY: 10,
        contentText: 'First page note',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/annotations',
      payload: {
        chapterId: 'chap_ann',
        pageNumber: 2,
        userId: 'reader_2',
        anchorX: 20,
        anchorY: 20,
        contentText: 'Second page note',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/chap_ann/annotations',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
  });

  it('PATCH /api/v1/annotations/:id/spoiler toggles spoiler flag', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/annotations',
      payload: {
        chapterId: 'chap_ann',
        pageNumber: 5,
        userId: 'reader_1',
        anchorX: 50,
        anchorY: 50,
        contentText: 'Spoiler detail',
        isSpoiler: false,
      },
    });
    const created = JSON.parse(postRes.body).annotation;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/annotations/${created.id}/spoiler`,
      payload: { isSpoiler: true },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.body);
    expect(patchBody.annotation.isSpoiler).toBe(true);
  });

  it('DELETE /api/v1/annotations/:id deletes annotation and enforces authorization', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/annotations',
      payload: {
        chapterId: 'chap_ann',
        pageNumber: 9,
        userId: 'alice',
        anchorX: 25,
        anchorY: 25,
        contentText: 'Alice only note',
      },
    });
    const created = JSON.parse(postRes.body).annotation;

    // Bob tries to delete
    const bobRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/annotations/${created.id}?userId=bob`,
    });
    expect(bobRes.statusCode).toBe(403);

    // Alice deletes
    const aliceRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/annotations/${created.id}?userId=alice`,
    });
    expect(aliceRes.statusCode).toBe(200);

    // Non-existent deletion returns 404
    const notFoundRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/annotations/99999`,
    });
    expect(notFoundRes.statusCode).toBe(404);
  });
});
