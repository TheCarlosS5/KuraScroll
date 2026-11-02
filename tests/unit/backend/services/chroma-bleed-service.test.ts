import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  ChromaBleedService,
  calculateChromaBleed,
  CHROMA_BLEED_PRESETS,
} from '../../../../src/backend/services/chroma-bleed-service.js';

describe('Sprint 110 - ChromaBleedService', () => {
  let db: DatabaseInstance;
  let service: ChromaBleedService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chroma_bleed_profiles (
        series_id TEXT PRIMARY KEY,
        color_mode TEXT NOT NULL DEFAULT 'monochrome_bw' CHECK (color_mode IN (
            'monochrome_bw',
            'sepia_vintage',
            'night_crimson',
            'cyberpunk_neon',
            'oled_pitch_black',
            'custom'
        )),
        color_temperature_k INTEGER NOT NULL DEFAULT 6500 CHECK (color_temperature_k >= 2000 AND color_temperature_k <= 9000),
        bleed_spread_px INTEGER NOT NULL DEFAULT 24 CHECK (bleed_spread_px >= 8 AND bleed_spread_px <= 64),
        ambient_intensity_pct INTEGER NOT NULL DEFAULT 35 CHECK (ambient_intensity_pct >= 0 AND ambient_intensity_pct <= 100),
        edge_falloff_exponent REAL NOT NULL DEFAULT 2.2 CHECK (edge_falloff_exponent >= 1.0 AND edge_falloff_exponent <= 4.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chroma_bleed_lookup ON chroma_bleed_profiles(series_id);
    `);

    service = new ChromaBleedService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('retrieves default monochrome_bw profile for unconfigured series', () => {
    const profile = service.getProfile('series-new');
    expect(profile.seriesId).toBe('series-new');
    expect(profile.colorMode).toBe('monochrome_bw');
    expect(profile.colorTemperatureK).toBe(6500);
    expect(profile.bleedSpreadPx).toBe(24);
    expect(profile.ambientIntensityPct).toBe(35);
    expect(profile.isEnabled).toBe(true);
  });

  it('upserts and retrieves custom chroma bleed profile', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-sepia',
      colorMode: 'sepia_vintage',
      colorTemperatureK: 3200,
      bleedSpreadPx: 32,
      ambientIntensityPct: 45,
      edgeFalloffExponent: 2.0,
      isEnabled: true,
    });

    expect(updated.seriesId).toBe('series-sepia');
    expect(updated.colorMode).toBe('sepia_vintage');
    expect(updated.colorTemperatureK).toBe(3200);

    const fetched = service.getProfile('series-sepia');
    expect(fetched.colorMode).toBe('sepia_vintage');
    expect(fetched.colorTemperatureK).toBe(3200);
    expect(fetched.bleedSpreadPx).toBe(32);
    expect(fetched.ambientIntensityPct).toBe(45);
  });

  it('clamps invalid numerical parameters within safety boundaries', () => {
    const clamped = service.upsertProfile({
      seriesId: 'series-clamped',
      colorTemperatureK: 15000, // max 9000
      bleedSpreadPx: 120, // max 64
      ambientIntensityPct: 200, // max 100
      edgeFalloffExponent: 0.2, // min 1.0
    });

    expect(clamped.colorTemperatureK).toBe(9000);
    expect(clamped.bleedSpreadPx).toBe(64);
    expect(clamped.ambientIntensityPct).toBe(100);
    expect(clamped.edgeFalloffExponent).toBe(1.0);
  });

  it('calculateChromaBleed computes warm amber for 2200K night crimson', () => {
    const res = calculateChromaBleed(2200, 40, 30, 1.8, 'night_crimson', true);
    expect(res.colorMode).toBe('night_crimson');
    expect(res.rgbColor.r).toBe(255);
    expect(res.rgbColor.b).toBeLessThan(res.rgbColor.r);
    expect(res.perceptualLuminance).toBeGreaterThan(0);
    expect(res.topGradient).toContain('linear-gradient');
    expect(res.perimeterShadow).toContain('inset');
    expect(res.latencyUs).toBeLessThan(100);
  });

  it('calculateChromaBleed computes cold cyan for 8000K cyberpunk neon', () => {
    const res = calculateChromaBleed(8000, 48, 60, 1.5, 'cyberpunk_neon', true);
    expect(res.colorMode).toBe('cyberpunk_neon');
    expect(res.rgbColor.b).toBe(255);
    expect(res.rgbColor.r).toBeLessThan(res.rgbColor.b);
  });

  it('calculateChromaBleed returns empty gradients when disabled', () => {
    const res = calculateChromaBleed(6500, 24, 35, 2.2, 'monochrome_bw', false);
    expect(res.topGradient).toBe('none');
    expect(res.bottomGradient).toBe('none');
    expect(res.perimeterShadow).toBe('none');
  });

  it('getPresets returns all predefined chroma presets', () => {
    const presets = service.getPresets();
    expect(presets.monochrome_bw).toBeDefined();
    expect(presets.sepia_vintage).toBeDefined();
    expect(presets.night_crimson).toBeDefined();
    expect(presets.cyberpunk_neon).toBeDefined();
    expect(presets.oled_pitch_black).toBeDefined();
  });
});
