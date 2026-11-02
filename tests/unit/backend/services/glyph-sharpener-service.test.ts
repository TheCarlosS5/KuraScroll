import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  GlyphSharpenerService,
  calculateGlyphSharpener,
  GLYPH_SHARPENER_PRESETS,
} from '../../../../src/backend/services/glyph-sharpener-service.js';

describe('Sprint 113 - GlyphSharpenerService', () => {
  let db: DatabaseInstance;
  let service: GlyphSharpenerService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS glyph_sharpener_profiles (
        series_id TEXT PRIMARY KEY,
        sharpener_mode TEXT NOT NULL DEFAULT 'adaptive_kanji' CHECK (sharpener_mode IN (
            'adaptive_kanji',
            'high_contrast_furigana',
            'kana_light',
            'dense_cjk_compaction',
            'custom_matrix'
        )),
        stroke_density_tier TEXT NOT NULL DEFAULT 'auto' CHECK (stroke_density_tier IN (
            'auto',
            'low_kana_1_5',
            'mid_kanji_6_14',
            'dense_kanji_15_plus'
        )),
        contrast_multiplier REAL NOT NULL DEFAULT 1.15 CHECK (contrast_multiplier >= 1.0 AND contrast_multiplier <= 1.50),
        luminance_gamma REAL NOT NULL DEFAULT 1.05 CHECK (luminance_gamma >= 0.80 AND luminance_gamma <= 1.30),
        stroke_protection_pct INTEGER NOT NULL DEFAULT 65 CHECK (stroke_protection_pct >= 0 AND stroke_protection_pct <= 100),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_glyph_sharpener_lookup ON glyph_sharpener_profiles(series_id);
    `);

    service = new GlyphSharpenerService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('retrieves default adaptive_kanji profile for unconfigured series', () => {
    const profile = service.getProfile('series-new');
    expect(profile.seriesId).toBe('series-new');
    expect(profile.sharpenerMode).toBe('adaptive_kanji');
    expect(profile.strokeDensityTier).toBe('auto');
    expect(profile.contrastMultiplier).toBe(1.15);
    expect(profile.luminanceGamma).toBe(1.05);
    expect(profile.strokeProtectionPct).toBe(65);
    expect(profile.isEnabled).toBe(true);
  });

  it('upserts and retrieves custom glyph sharpener profile', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-dense',
      sharpenerMode: 'dense_cjk_compaction',
      strokeDensityTier: 'dense_kanji_15_plus',
      contrastMultiplier: 1.10,
      luminanceGamma: 0.98,
      strokeProtectionPct: 85,
    });

    expect(updated.seriesId).toBe('series-dense');
    expect(updated.sharpenerMode).toBe('dense_cjk_compaction');
    expect(updated.strokeProtectionPct).toBe(85);

    const fetched = service.getProfile('series-dense');
    expect(fetched.sharpenerMode).toBe('dense_cjk_compaction');
    expect(fetched.strokeProtectionPct).toBe(85);
  });

  it('computes adaptive contrast and brightness enhancement in < 20 µs', () => {
    const result = calculateGlyphSharpener(8, 1.0, 1.15, 1.05, 65, 'adaptive_kanji', true);
    expect(result.sharpenerMode).toBe('adaptive_kanji');
    expect(result.effectiveContrast).toBeGreaterThan(1.0);
    expect(result.effectiveBrightness).toBeLessThan(1.0);
    expect(result.cssFilter).toContain('contrast(');
    expect(result.textRendering).toBe('geometricPrecision');
    expect(result.webkitFontSmoothing).toBe('antialiased');
    expect(result.isDenseStrokeCompensated).toBe(false);
    expect(result.latencyUs).toBeLessThan(100);
  });

  it('protects dense kanji (15+ strokes) by moderating contrast boost to prevent stroke fill-in', () => {
    const standardKanji = calculateGlyphSharpener(6, 1.0, 1.25, 1.05, 65, 'adaptive_kanji', true);
    const complexKanji = calculateGlyphSharpener(20, 1.0, 1.25, 1.05, 65, 'adaptive_kanji', true);

    expect(complexKanji.isDenseStrokeCompensated).toBe(true);
    expect(complexKanji.effectiveContrast).toBeLessThan(standardKanji.effectiveContrast);
    expect(complexKanji.strokeProtectionFactor).toBeGreaterThan(standardKanji.strokeProtectionFactor);
  });

  it('handles disabled state with fallback default CSS filter', () => {
    const result = calculateGlyphSharpener(10, 1.0, 1.20, 1.00, 50, 'adaptive_kanji', false);
    expect(result.effectiveContrast).toBe(1.0);
    expect(result.effectiveBrightness).toBe(1.0);
    expect(result.cssFilter).toBe('none');
    expect(result.textRendering).toBe('auto');
  });

  it('provides valid presets catalogue matching hardware specifications', () => {
    const presets = service.getPresets();
    expect(presets.adaptive_kanji.sharpenerMode).toBe('adaptive_kanji');
    expect(presets.high_contrast_furigana.contrastMultiplier).toBe(1.25);
    expect(presets.kana_light.strokeProtectionPct).toBe(20);
    expect(presets.dense_cjk_compaction.strokeProtectionPct).toBe(85);
  });
});
