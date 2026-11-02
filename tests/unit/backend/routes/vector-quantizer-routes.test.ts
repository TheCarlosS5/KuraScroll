/**
 * KuraScroll Sprint 100: Vector Quantizer Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { vectorQuantizerRoutes, computeVectorQuantizerEtag } from '../../../../src/backend/routes/vector-quantizer-routes.js';
import { VectorQuantizerService } from '../../../../src/backend/services/vector-quantizer-service.js';

describe('vectorQuantizerRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS vector_index_profiles (
        series_id TEXT PRIMARY KEY,
        index_mode TEXT NOT NULL DEFAULT 'int8_quantized' CHECK (index_mode IN (
            'int8_quantized',
            'compact_scalar',
            'exact_cosine',
            'custom'
        )),
        embedding_dimension INTEGER NOT NULL DEFAULT 64 CHECK (embedding_dimension >= 16 AND embedding_dimension <= 256),
        similarity_threshold REAL NOT NULL DEFAULT 0.75 CHECK (similarity_threshold >= 0.10 AND similarity_threshold <= 0.99),
        max_top_k INTEGER NOT NULL DEFAULT 5 CHECK (max_top_k >= 1 AND max_top_k <= 50),
        is_spoiler_shield_active INTEGER NOT NULL DEFAULT 1 CHECK (is_spoiler_shield_active IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vector_index_lookup ON vector_index_profiles(series_id);
    `);

    app = Fastify();
    await app.register(vectorQuantizerRoutes, {
      db,
      vectorQuantizerService: new VectorQuantizerService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/vector-quantizer/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/vector-quantizer/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.int8_quantized).toBeDefined();
    expect(body.presets.compact_scalar).toBeDefined();
    expect(body.presets.exact_cosine).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/vector-quantizer/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/vector-quantizer/profile/shingeki-no-kyojin-vol-1',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('shingeki-no-kyojin-vol-1');
    expect(body.profile.indexMode).toBe('int8_quantized');

    // 304 Not Modified check
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/vector-quantizer/profile/shingeki-no-kyojin-vol-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/vector-quantizer/profile updates profile and invalidates cache', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/vector-quantizer/profile',
      payload: {
        seriesId: 'shingeki-no-kyojin-vol-1',
        indexMode: 'exact_cosine',
        embeddingDimension: 128,
        similarityThreshold: 0.85,
        maxTopK: 10,
        isSpoilerShieldActive: false,
        isEnabled: true,
      },
    });
    expect(postRes.statusCode).toBe(200);
    const postBody = postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.profile.indexMode).toBe('exact_cosine');
    expect(postBody.profile.embeddingDimension).toBe(128);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/vector-quantizer/profile/shingeki-no-kyojin-vol-1',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.profile.indexMode).toBe('exact_cosine');
  });

  it('POST /api/v1/reader/vector-quantizer/calculate-similarity returns valid similarity & spoiler shield', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/vector-quantizer/calculate-similarity',
      payload: {
        queryVec: [10, 20, 30, 40],
        candidateVec: [10, 20, 30, 40],
        dimension: 64,
        similarityThreshold: 0.75,
        isSpoilerShieldActive: true,
        candidateRevealChapter: 50,
        userCurrentChapter: 12,
        mode: 'int8_quantized',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.cosineSimilarity).toBe(1.0);
    expect(body.result.isMatch).toBe(true);
    expect(body.result.isSpoilerShielded).toBe(true); // 50 > 12 -> shielded
  });

  it('computes consistent ETag', () => {
    const etag1 = computeVectorQuantizerEtag('s1', 'int8_quantized', 64, 0.75, 5, true, true, 100);
    const etag2 = computeVectorQuantizerEtag('s1', 'int8_quantized', 64, 0.75, 5, true, true, 100);
    const etag3 = computeVectorQuantizerEtag('s1', 'exact_cosine', 128, 0.85, 10, false, true, 100);
    expect(etag1).toBe(etag2);
    expect(etag1).not.toBe(etag3);
  });
});
