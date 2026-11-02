import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Hybrid Vector Search Fastify Routes (Sprint 47)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES 
        ('s-chainsaw', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing'),
        ('s-jujutsu', 'jujutsu-kaisen', 'Jujutsu Kaisen', 'manga', 'completed')
    `).run();

    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-chainsaw', 'en', 'Chainsaw Man', 1)`).run();
    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-jujutsu', 'en', 'Jujutsu Kaisen', 1)`).run();

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/search/hybrid rejects request when both query and vector are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/search/hybrid',
      payload: {}
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Must provide either query text or query vector');
  });

  it('POST /api/v1/admin/embeddings/batch ingests vectors and GET stats reflects count', async () => {
    const dummyVec = Array.from({ length: 384 }, (_, i) => Math.sin(i));

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/embeddings/batch',
      payload: {
        items: [
          { seriesId: 's-chainsaw', vector: dummyVec },
          { seriesId: 's-jujutsu', vector: dummyVec }
        ]
      }
    });

    expect(postRes.statusCode).toBe(200);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.count).toBe(2);

    const statsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/embeddings/stats'
    });

    expect(statsRes.statusCode).toBe(200);
    const statsBody = JSON.parse(statsRes.payload);
    expect(statsBody.totalEmbeddings).toBe(2);
    expect(statsBody.quantization).toBe('int8');
    expect(statsBody.memoryFootprintBytes).toBe(2 * 384);
  });

  it('POST /api/v1/search/hybrid returns hybrid results with RRF rankings', async () => {
    const dummyVec = Array.from({ length: 384 }, (_, i) => (i < 30 ? 1.0 : 0.0));

    // Seed vector for Chainsaw Man
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/embeddings/batch',
      payload: {
        items: [{ seriesId: 's-chainsaw', vector: dummyVec }]
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/search/hybrid',
      payload: {
        query: 'Chainsaw',
        vector: dummyVec
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.results.length).toBeGreaterThanOrEqual(1);

    const topHit = body.results[0];
    expect(topHit.seriesId).toBe('s-chainsaw');
    expect(topHit.matchType).toBe('hybrid');
    expect(body.telemetry.vectorsEvaluated).toBe(1);
  });
});
