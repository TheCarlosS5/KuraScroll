/**
 * KuraScroll Sprint 98: Reading Dwell Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { readingDwellRoutes, computeReadingDwellEtag } from '../../../../src/backend/routes/reading-dwell-routes.js';
import { ReadingDwellService } from '../../../../src/backend/services/reading-dwell-service.js';

describe('readingDwellRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS reading_dwell_profiles (
        series_id TEXT PRIMARY KEY,
        prediction_mode TEXT NOT NULL DEFAULT 'cadence_adaptive' CHECK (prediction_mode IN (
            'cadence_adaptive',
            'action_heavy',
            'dialogue_dense',
            'custom'
        )),
        base_dwell_ms INTEGER NOT NULL DEFAULT 4500 CHECK (base_dwell_ms >= 1000 AND base_dwell_ms <= 30000),
        complexity_weight REAL NOT NULL DEFAULT 1.25 CHECK (complexity_weight >= 0.50 AND complexity_weight <= 3.00),
        urgency_threshold_ms INTEGER NOT NULL DEFAULT 800 CHECK (urgency_threshold_ms >= 200 AND urgency_threshold_ms <= 3000),
        is_prefetch_trigger_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_prefetch_trigger_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reading_dwell_lookup ON reading_dwell_profiles(series_id);
    `);

    app = Fastify();
    await app.register(readingDwellRoutes, {
      db,
      readingDwellService: new ReadingDwellService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/reading-dwell/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/reading-dwell/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.cadence_adaptive).toBeDefined();
    expect(body.presets.action_heavy).toBeDefined();
    expect(body.presets.dialogue_dense).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/reading-dwell/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/reading-dwell/profile/death-note-vol-1',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('death-note-vol-1');
    expect(body.profile.predictionMode).toBe('cadence_adaptive');

    // 304 Not Modified check
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/reading-dwell/profile/death-note-vol-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/reading-dwell/profile updates profile and invalidates cache', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/reading-dwell/profile',
      payload: {
        seriesId: 'death-note-vol-1',
        predictionMode: 'dialogue_dense',
        baseDwellMs: 7500,
        complexityWeight: 1.80,
        urgencyThresholdMs: 1000,
        isPrefetchTriggerEnabled: true,
        isEnabled: true,
      },
    });
    expect(postRes.statusCode).toBe(200);
    const postBody = postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.profile.predictionMode).toBe('dialogue_dense');
    expect(postBody.profile.baseDwellMs).toBe(7500);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/reading-dwell/profile/death-note-vol-1',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.profile.predictionMode).toBe('dialogue_dense');
  });

  it('POST /api/v1/reader/reading-dwell/calculate-prediction returns valid dwell metrics', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/reading-dwell/calculate-prediction',
      payload: {
        elapsedMs: 2000,
        baseDwellMs: 4500,
        complexityWeight: 1.25,
        urgencyThresholdMs: 800,
        mode: 'cadence_adaptive',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.predictedTotalDwellMs).toBe(5625);
    expect(body.result.remainingDwellMs).toBe(3625);
    expect(body.result.progressPct).toBe(36);
    expect(body.result.isUrgentPrefetchTriggered).toBe(false);
  });

  it('computes consistent ETag', () => {
    const etag1 = computeReadingDwellEtag('s1', 'cadence_adaptive', 4500, 1.25, 800, true, true, 100);
    const etag2 = computeReadingDwellEtag('s1', 'cadence_adaptive', 4500, 1.25, 800, true, true, 100);
    const etag3 = computeReadingDwellEtag('s1', 'action_heavy', 2500, 0.85, 600, true, true, 100);
    expect(etag1).toBe(etag2);
    expect(etag1).not.toBe(etag3);
  });
});
