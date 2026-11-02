import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { recapRoutes } from '../../../src/backend/routes/recap-routes.js';
import { StoryRecapService } from '../../../src/backend/services/story-recap-service.js';

describe('Recap Routes Integration (Sprint 48)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: StoryRecapService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new StoryRecapService(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('series-bleach', 'bleach', 'Bleach', 'manga', 'completed')
    `).run();

    service.upsertRecap({
      seriesId: 'series-bleach',
      throughChapterSeq: 63,
      arcTitle: 'Substitute Shinigami Arc',
      summaryText: 'Ichigo becomes a Soul Reaper.',
      characterStatuses: [
        { id: 'ichigo', name: 'Ichigo Kurosaki', role: 'Substitute Shinigami', status: 'active' },
      ],
      keyEvents: [
        { chapter: 1, title: 'Death & Strawberry', description: 'Rukia lends powers', significance: 'pivotal' },
      ],
    });

    service.upsertRecap({
      seriesId: 'series-bleach',
      throughChapterSeq: 181,
      arcTitle: 'Soul Society: The Rescue',
      summaryText: 'Rescuing Rukia from the execution ground.',
      characterStatuses: [
        { id: 'ichigo', name: 'Ichigo Kurosaki', role: 'Bankai Achieved', status: 'active' },
      ],
    });

    app = Fastify({ logger: false });
    await app.register(recapRoutes, { db, recapService: service });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    db.close();
  });

  it('GET /api/v1/recaps/chapter enforces anti-spoiler logic correctly', async () => {
    // Opening Chapter 100 -> gets Substitute Shinigami Arc (throughChapterSeq: 63)
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/recaps/chapter?seriesId=series-bleach&chapterNumber=100',
    });

    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.payload);
    expect(body1.success).toBe(true);
    expect(body1.recap).not.toBeNull();
    expect(body1.recap.throughChapterSeq).toBe(63);
    expect(body1.recap.arcTitle).toBe('Substitute Shinigami Arc');

    // Opening Chapter 1 -> gets null
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/recaps/chapter?seriesId=series-bleach&chapterNumber=1',
    });

    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.success).toBe(true);
    expect(body2.recap).toBeNull();
  });

  it('GET /api/v1/recaps/chapter detects inactivity catch-up flag', async () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/recaps/chapter?seriesId=series-bleach&chapterNumber=200&lastReadAt=${encodeURIComponent(twentyDaysAgo)}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.isCatchUpRecommended).toBe(true);
    expect(body.recap.throughChapterSeq).toBe(181);
  });

  it('GET /api/v1/recaps/chapter validates required query params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/recaps/chapter',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad Request');
  });

  it('GET /api/v1/recaps/series/:seriesId returns full arc history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/recaps/series/series-bleach',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.recaps).toHaveLength(2);
  });

  it('POST /api/v1/admin/recaps and DELETE /api/v1/admin/recaps/:id work seamlessly', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/recaps',
      payload: {
        seriesId: 'series-bleach',
        throughChapterSeq: 423,
        arcTitle: 'Arrancar: Decisive Battle of Karakura',
        summaryText: 'Aizen is defeated using Mugetsu.',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.recap.throughChapterSeq).toBe(423);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/recaps/${postBody.recap.id}`,
    });

    expect(deleteRes.statusCode).toBe(200);
    const deleteBody = JSON.parse(deleteRes.payload);
    expect(deleteBody.deleted).toBe(true);
  });
});
