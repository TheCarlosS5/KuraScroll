import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { textureAtlasRoutes } from '../../../../src/backend/routes/texture-atlas-routes.js';
import { TextureAtlasService } from '../../../../src/backend/services/texture-atlas-service.js';

describe('Sprint 112 - Texture Atlas Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: TextureAtlasService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS texture_atlas_profiles (
        series_id TEXT PRIMARY KEY,
        packing_strategy TEXT NOT NULL DEFAULT 'guillotine_bssf' CHECK (packing_strategy IN (
            'guillotine_bssf',
            'shelf_next_fit',
            'max_rects_compact'
        )),
        atlas_max_dimension INTEGER NOT NULL DEFAULT 2048 CHECK (atlas_max_dimension IN (1024, 2048, 4096)),
        tile_padding_px INTEGER NOT NULL DEFAULT 4 CHECK (tile_padding_px >= 0 AND tile_padding_px <= 16),
        max_active_atlases INTEGER NOT NULL DEFAULT 2 CHECK (max_active_atlases >= 1 AND max_active_atlases <= 4),
        vram_budget_mb INTEGER NOT NULL DEFAULT 32 CHECK (vram_budget_mb >= 16 AND vram_budget_mb <= 64),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_texture_atlas_lookup ON texture_atlas_profiles(series_id);
    `);

    service = new TextureAtlasService(db);
    app = Fastify({ logger: false });
    await app.register(textureAtlasRoutes, { db, textureAtlasService: service });
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

  it('GET /api/v1/reader/texture-atlas/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/texture-atlas/profile/series-atlas-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-atlas-1');
    expect(body.profile.packingStrategy).toBe('guillotine_bssf');
    expect(body.profile.atlasMaxDimension).toBe(2048);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/texture-atlas/profile/:seriesId supports ETag 304', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/texture-atlas/profile/series-etag',
    });
    const etag = initial.headers.etag;

    const cached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/texture-atlas/profile/series-etag',
      headers: { 'if-none-match': etag },
    });

    expect(cached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/texture-atlas/profile updates profile and validates', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/texture-atlas/profile',
      payload: {
        seriesId: 'series-atlas-1',
        packingStrategy: 'shelf_next_fit',
        atlasMaxDimension: 1024,
        vramBudgetMb: 16,
      },
    });

    expect(postRes.statusCode).toBe(200);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.profile.packingStrategy).toBe('shelf_next_fit');
    expect(postBody.profile.atlasMaxDimension).toBe(1024);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/texture-atlas/profile/series-atlas-1',
    });
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.profile.packingStrategy).toBe('shelf_next_fit');
    expect(getBody.profile.atlasMaxDimension).toBe(1024);
  });

  it('POST /api/v1/reader/texture-atlas/pack computes UV mapping and VRAM footprint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/texture-atlas/pack',
      payload: {
        tileId: 'tile-001',
        rawW: 512,
        rawH: 512,
        sequenceIndex: 0,
        atlasMaxDimension: 2048,
        tilePaddingPx: 4,
        maxActiveAtlases: 2,
        vramBudgetMb: 32,
        strategy: 'guillotine_bssf',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.result.tileId).toBe('tile-001');
    expect(body.result.atlasIndex).toBe(0);
    expect(body.result.u).toBe(4 / 2048);
    expect(body.result.v).toBe(4 / 2048);
    expect(body.result.vramUsageMb).toBe(16);
    expect(body.result.isEvictionTriggered).toBe(false);
  });

  it('GET /api/v1/reader/texture-atlas/presets returns predefined hardware presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/texture-atlas/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.presets.gma_4500mhd_strict).toBeDefined();
    expect(body.presets.hd_canvas_4096).toBeDefined();
    expect(body.presets.low_memory_1024).toBeDefined();
  });
});
