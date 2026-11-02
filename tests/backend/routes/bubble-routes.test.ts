import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Speech Bubble Multilingual Overlay Routes (Sprint 46)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-bubble-route', 'death-note', 'Death Note', 'manga', 'completed')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES ('dn-c1', 's-bubble-route', 1.0, 45, '/storage/dn-c1')
    `).run();

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/chapters/:chapterId/pages/:pageNumber/bubbles returns empty array when no bubbles exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/dn-c1/pages/1/bubbles'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.totalBubbles).toBe(0);
    expect(body.bubbles).toEqual([]);
  });

  it('POST /api/v1/chapters/:chapterId/pages/:pageNumber/bubbles saves bubbles and GET retrieves them', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/dn-c1/pages/1/bubbles',
      payload: {
        bubbles: [
          {
            index: 0,
            bbox: { x: 50.0, y: 15.0, width: 30.0, height: 25.0 },
            readingDirection: 'vertical',
            rawText: '計画通り',
            translatedTextEs: 'Tal como lo planeé',
            translatedTextEn: 'Just as planned',
            ruby: [
              { base: '計画', ruby: 'けいかく' },
              { base: '通り', ruby: 'どおり' }
            ],
            confidence: 0.99
          }
        ]
      }
    });

    expect(postRes.statusCode).toBe(200);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.bubblesCount).toBe(1);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/dn-c1/pages/1/bubbles'
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.totalBubbles).toBe(1);
    expect(getBody.bubbles[0].rawText).toBe('計画通り');
    expect(getBody.bubbles[0].translations.es).toBe('Tal como lo planeé');
    expect(getBody.bubbles[0].ruby[0].ruby).toBe('けいかく');
  });

  it('POST /api/v1/chapters/:chapterId/bubbles/import bulk imports manifest and GET summary reports counts', async () => {
    const importRes = await app.inject({
      method: 'POST',
      url: '/api/v1/chapters/dn-c1/bubbles/import',
      payload: {
        pages: [
          {
            pageNumber: 2,
            bubbles: [
              { bbox: { x: 10, y: 10, width: 20, height: 20 }, rawText: 'P2 B1' }
            ]
          },
          {
            pageNumber: 3,
            bubbles: [
              { bbox: { x: 30, y: 30, width: 25, height: 25 }, rawText: 'P3 B1' },
              { bbox: { x: 60, y: 60, width: 20, height: 20 }, rawText: 'P3 B2' }
            ]
          }
        ]
      }
    });

    expect(importRes.statusCode).toBe(200);
    const importBody = JSON.parse(importRes.payload);
    expect(importBody.pagesImported).toBe(2);
    expect(importBody.bubblesImported).toBe(3);

    const sumRes = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/dn-c1/bubbles/summary'
    });

    expect(sumRes.statusCode).toBe(200);
    const sumBody = JSON.parse(sumRes.payload);
    expect(sumBody.totalBubbles).toBe(3);
    expect(sumBody.pagesWithBubbles).toBe(2);
  });
});
