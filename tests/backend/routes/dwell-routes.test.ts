import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Dwell & Kinetic Attention Heatmap Routes (Sprint 45)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed test series and chapter
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-heat', 'tower-of-god', 'Tower of God', 'manhwa', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, page_count, storage_path)
      VALUES ('tog-ch1', 's-heat', 1.0, 'Chapter 1: The Tower Beckons', 30, '/storage/tog-ch1')
    `).run();

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/analytics/dwell/batch accepts valid dwell events and rejects skims', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/dwell/batch',
      payload: {
        events: [
          { chapterId: 'tog-ch1', pageNumber: 1, dwellSeconds: 12.5 },
          { chapterId: 'tog-ch1', pageNumber: 2, dwellSeconds: 0.3 }, // rejected skim (< 1.0s)
          { chapterId: 'tog-ch1', pageNumber: 3, dwellSeconds: 25.0, scrollVelocity: 2100 } // rejected skim (velocity > 1500)
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(2);
    expect(body.dirtyBuffered).toBe(1);
  });

  it('POST /api/v1/analytics/dwell/batch returns 400 when events array is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/dwell/batch',
      payload: {}
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Request body must contain an array of events');
  });

  it('GET /api/v1/analytics/chapter/:chapterId/dwell-heatmap returns full attention metrics', async () => {
    // Ingest events
    await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/dwell/batch',
      payload: {
        events: [
          { chapterId: 'tog-ch1', pageNumber: 1, dwellSeconds: 15.0 },
          { chapterId: 'tog-ch1', pageNumber: 5, dwellSeconds: 45.0 },
          { chapterId: 'tog-ch1', pageNumber: 12, dwellSeconds: 90.0 }
        ]
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/chapter/tog-ch1/dwell-heatmap'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.chapterId).toBe('tog-ch1');
    expect(body.totalPages).toBe(30);
    expect(body.metrics.peakAttentionPage).toBe(12);
    expect(body.metrics.peakDwellSeconds).toBe(90.0);
    expect(body.heatmap.length).toBe(3);

    const peakPage = body.heatmap.find((p: any) => p.pageNumber === 12);
    expect(peakPage.tier).toBe('epic');
    expect(peakPage.intensityScore).toBe(100.0);
  });

  it('GET /api/v1/analytics/chapter/:chapterId/dwell-heatmap applies privacy restriction when minReads specified', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/dwell/batch',
      payload: {
        events: [
          { chapterId: 'tog-ch1', pageNumber: 1, dwellSeconds: 20.0 }
        ]
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/chapter/tog-ch1/dwell-heatmap?minReads=20'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.privacyRestricted).toBe(true);
    expect(body.heatmap).toEqual([]);
    expect(body.metrics.totalSessionViews).toBe(1);
  });

  it('POST /api/v1/analytics/dwell/flush flushes write-behind buffer manually', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/dwell/batch',
      payload: {
        events: [
          { chapterId: 'tog-ch1', pageNumber: 2, dwellSeconds: 20.0 }
        ]
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/dwell/flush'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.flushedCount).toBeGreaterThanOrEqual(1);
    expect(body.telemetry.dirtyCount).toBe(0);
  });

  it('GET /api/v1/analytics/dwell/telemetry returns telemetry statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/dwell/telemetry'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.telemetry).toBeDefined();
    expect(typeof body.telemetry.dirtyCount).toBe('number');
  });
});
