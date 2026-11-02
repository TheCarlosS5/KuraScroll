import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { pageBevelRoutes } from '../../../../src/backend/routes/page-bevel-routes.js';
import { PageBevelService } from '../../../../src/backend/services/page-bevel-service.js';

describe('Sprint 109 - Page Bevel Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: PageBevelService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS page_bevel_profiles (
        series_id TEXT PRIMARY KEY,
        paper_caliper_mode TEXT NOT NULL DEFAULT 'tankobon_silk_110um' CHECK (paper_caliper_mode IN (
            'newsprint_65um',
            'pulp_85um',
            'tankobon_silk_110um',
            'omnibus_coated_130um',
            'custom'
        )),
        max_stack_thickness_px INTEGER NOT NULL DEFAULT 24 CHECK (max_stack_thickness_px >= 4 AND max_stack_thickness_px <= 48),
        page_caliper_um REAL NOT NULL DEFAULT 110.0 CHECK (page_caliper_um >= 40.0 AND page_caliper_um <= 300.0),
        curvature_sag_pct INTEGER NOT NULL DEFAULT 35 CHECK (curvature_sag_pct >= 0 AND curvature_sag_pct <= 100),
        edge_bevel_shading_pct INTEGER NOT NULL DEFAULT 40 CHECK (edge_bevel_shading_pct >= 0 AND edge_bevel_shading_pct <= 100),
        reading_direction TEXT NOT NULL DEFAULT 'rtl' CHECK (reading_direction IN ('rtl', 'ltr', 'vertical')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_page_bevel_lookup ON page_bevel_profiles(series_id);
    `);

    service = new PageBevelService(db);
    app = Fastify({ logger: false });
    await app.register(pageBevelRoutes, { db, pageBevelService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('GET /api/v1/reader/page-bevel/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-bevel/profile/series-bevel-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-bevel-1');
    expect(body.profile.paperCaliperMode).toBe('tankobon_silk_110um');
    expect(body.profile.maxStackThicknessPx).toBe(24);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/page-bevel/profile/:seriesId supports ETag 304', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-bevel/profile/series-etag',
    });
    const etag = initial.headers.etag;

    const cached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-bevel/profile/series-etag',
      headers: { 'if-none-match': etag },
    });

    expect(cached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/page-bevel/profile updates profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-bevel/profile',
      payload: {
        seriesId: 'series-bevel-update',
        paperCaliperMode: 'omnibus_coated_130um',
        maxStackThicknessPx: 36,
        curvatureSagPct: 45,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.profile.seriesId).toBe('series-bevel-update');
    expect(body.profile.paperCaliperMode).toBe('omnibus_coated_130um');
    expect(body.profile.maxStackThicknessPx).toBe(36);
  });

  it('POST /api/v1/reader/page-bevel/calculate evaluates stack thickness and bevel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-bevel/calculate',
      payload: {
        currentPage: 50,
        totalPages: 200,
        maxStackThicknessPx: 24,
        curvatureSagPct: 35,
        edgeBevelShadingPct: 40,
        readingDirection: 'rtl',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.result.leftThicknessPx).toBe(6);
    expect(body.result.rightThicknessPx).toBe(18);
    expect(body.result.leftPagesCount).toBe(49);
    expect(body.result.rightPagesCount).toBe(150);
    expect(body.result.leftBevelGradient).toContain('linear-gradient');
    expect(body.result.rightBevelGradient).toContain('linear-gradient');
    expect(body.result.latencyUs).toBeLessThan(100);
  });

  it('GET /api/v1/reader/page-bevel/presets returns all paper caliper presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-bevel/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.presets.tankobon_silk_110um).toBeDefined();
    expect(body.presets.newsprint_65um).toBeDefined();
    expect(body.presets.pulp_85um).toBeDefined();
    expect(body.presets.omnibus_coated_130um).toBeDefined();
  });
});
