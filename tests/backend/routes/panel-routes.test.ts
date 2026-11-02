import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { PanelDetectionService } from '../../../src/backend/services/panel-detection-service.js';
import { registerPanelRoutes } from '../../../src/backend/routes/panel-routes.js';

describe('Sprint 55: Panel & Dialogue Bubble Fastify Routes Suite', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: PanelDetectionService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 's-1', 'Test Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('ch1', 's1', 1.0, 'Chapter 1', '/storage/ch1')
    `).run();

    service = new PanelDetectionService(db);
    app = Fastify();
    await app.register(registerPanelRoutes, { panelService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/chapters/:chapterId/pages/:pageNumber/panels returns empty list initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch1/pages/1/panels'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.panels).toEqual([]);
  });

  it('POST /api/v1/chapters/:chapterId/pages/:pageNumber/panels saves panels and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/ch1/pages/1/panels',
      payload: {
        panels: [
          { x: 10, y: 10, w: 30, h: 40 },
          { x: 50, y: 10, w: 40, h: 40 }
        ],
        direction: 'RTL'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.count).toBe(2);
    expect(body.panels[0].readingOrder).toBe(0);
  });

  it('POST & GET /api/v1/chapters/:chapterId/pages/:pageNumber/ocr-bubbles roundtrip', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/ch1/pages/1/ocr-bubbles',
      payload: {
        bubbles: [
          {
            x: 20,
            y: 20,
            w: 15,
            h: 15,
            text: 'Nani?! Bakana!',
            language: 'ja'
          }
        ]
      }
    });

    expect(postRes.statusCode).toBe(201);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch1/pages/1/ocr-bubbles'
    });

    expect(getRes.statusCode).toBe(200);
    const body = JSON.parse(getRes.body);
    expect(body.bubbles).toHaveLength(1);
    expect(body.bubbles[0].text).toBe('Nani?! Bakana!');
  });

  it('GET /api/v1/search/dialogue executes FTS5 search across dialogue bubbles', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/ch1/pages/1/ocr-bubbles',
      payload: {
        bubbles: [
          {
            x: 10,
            y: 10,
            w: 20,
            h: 20,
            text: 'Shinzou wo Sasageyo!'
          }
        ]
      }
    });

    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/v1/search/dialogue?q=Sasageyo'
    });

    expect(searchRes.statusCode).toBe(200);
    const body = JSON.parse(searchRes.body);
    expect(body.count).toBe(1);
    expect(body.results[0].text).toContain('Sasageyo');
  });
});
