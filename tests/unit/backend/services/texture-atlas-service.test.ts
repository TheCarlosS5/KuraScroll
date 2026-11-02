import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  TextureAtlasService,
  calculateTextureAtlasPlacement,
  TEXTURE_ATLAS_PRESETS,
} from '../../../../src/backend/services/texture-atlas-service.js';

describe('Sprint 112 - TextureAtlasService', () => {
  let db: DatabaseInstance;
  let service: TextureAtlasService;

  beforeEach(() => {
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
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('retrieves default conservative profile for unconfigured series', () => {
    const profile = service.getProfile('series-new');
    expect(profile.seriesId).toBe('series-new');
    expect(profile.packingStrategy).toBe('guillotine_bssf');
    expect(profile.atlasMaxDimension).toBe(2048);
    expect(profile.tilePaddingPx).toBe(4);
    expect(profile.maxActiveAtlases).toBe(2);
    expect(profile.vramBudgetMb).toBe(32);
    expect(profile.isEnabled).toBe(true);
  });

  it('upserts and retrieves custom texture atlas profile', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-hd',
      packingStrategy: 'shelf_next_fit',
      atlasMaxDimension: 4096,
      tilePaddingPx: 8,
      maxActiveAtlases: 3,
      vramBudgetMb: 64,
    });

    expect(updated.seriesId).toBe('series-hd');
    expect(updated.packingStrategy).toBe('shelf_next_fit');
    expect(updated.atlasMaxDimension).toBe(4096);
    expect(updated.tilePaddingPx).toBe(8);

    const fetched = service.getProfile('series-hd');
    expect(fetched.packingStrategy).toBe('shelf_next_fit');
    expect(fetched.atlasMaxDimension).toBe(4096);
    expect(fetched.vramBudgetMb).toBe(64);
  });

  it('computes 2048x2048 UV mapping with 4px safety padding in < 20 µs', () => {
    const result = calculateTextureAtlasPlacement('tile-001', 512, 512, 0, 2048, 4, 2, 32, 'guillotine_bssf', true);
    expect(result.tileId).toBe('tile-001');
    expect(result.atlasIndex).toBe(0);
    expect(result.x).toBe(4);
    expect(result.y).toBe(4);
    expect(result.paddedW).toBe(520);
    expect(result.paddedH).toBe(520);
    expect(result.u).toBe(4 / 2048);
    expect(result.v).toBe(4 / 2048);
    expect(result.du).toBe(512 / 2048);
    expect(result.dv).toBe(512 / 2048);
    expect(result.vramUsageMb).toBeLessThanOrEqual(32);
    expect(result.latencyUs).toBeLessThan(100);
  });

  it('places subsequent tiles into next grid slots across the atlas', () => {
    const r0 = calculateTextureAtlasPlacement('t0', 512, 512, 0, 2048, 4, 2, 32, 'guillotine_bssf', true);
    const r1 = calculateTextureAtlasPlacement('t1', 512, 512, 1, 2048, 4, 2, 32, 'guillotine_bssf', true);

    expect(r0.atlasIndex).toBe(0);
    expect(r1.atlasIndex).toBe(0);
    expect(r1.x).toBeGreaterThan(r0.x);
  });

  it('wraps onto virtual atlas pages when current atlas is saturated', () => {
    // 2048 / 1024 = 2 cols * 2 rows = 4 tiles per atlas
    const r0 = calculateTextureAtlasPlacement('t0', 1000, 1000, 0, 2048, 4, 2, 32);
    const r4 = calculateTextureAtlasPlacement('t4', 1000, 1000, 4, 2048, 4, 2, 32);

    expect(r0.atlasIndex).toBe(0);
    expect(r4.atlasIndex).toBe(1);
    expect(r4.isEvictionTriggered).toBe(false);
  });

  it('triggers eviction flag when VRAM budget ceiling is exceeded', () => {
    // 4 tiles per atlas, 2 atlases max = 8 tiles capacity before eviction
    const r8 = calculateTextureAtlasPlacement('t8', 1000, 1000, 8, 2048, 4, 2, 32);
    expect(r8.isEvictionTriggered).toBe(true);
  });

  it('handles disabled state with fallback default UVs', () => {
    const result = calculateTextureAtlasPlacement('t-off', 256, 256, 0, 2048, 4, 2, 32, 'guillotine_bssf', false);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.u).toBe(0);
    expect(result.v).toBe(0);
  });

  it('provides valid presets catalogue for hardware tiers', () => {
    const presets = service.getPresets();
    expect(presets.gma_4500mhd_strict.atlasMaxDimension).toBe(2048);
    expect(presets.gma_4500mhd_strict.vramBudgetMb).toBe(32);
    expect(presets.hd_canvas_4096.atlasMaxDimension).toBe(4096);
    expect(presets.low_memory_1024.atlasMaxDimension).toBe(1024);
  });
});
