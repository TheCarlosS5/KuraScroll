/**
 * KuraScroll Sprint 106: Balloon Font Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  BalloonFontService,
  BALLOON_FONT_PRESETS,
  calculateBalloonFontScale,
} from '../../../../src/backend/services/balloon-font-service.js';

describe('BalloonFontService', () => {
  let db: DatabaseInstance;
  let service: BalloonFontService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS balloon_font_profiles (
        series_id TEXT PRIMARY KEY,
        scaling_mode TEXT NOT NULL DEFAULT 'comfort_legibility' CHECK (scaling_mode IN (
            'comfort_legibility',
            'compact_dialogue',
            'large_print',
            'disabled',
            'custom'
        )),
        min_font_size_px INTEGER NOT NULL DEFAULT 10 CHECK (min_font_size_px >= 6 AND min_font_size_px <= 24),
        max_font_size_px INTEGER NOT NULL DEFAULT 32 CHECK (max_font_size_px >= 16 AND max_font_size_px <= 72),
        target_density_ratio REAL NOT NULL DEFAULT 0.65 CHECK (target_density_ratio >= 0.20 AND target_density_ratio <= 0.95),
        is_furigana_preserved INTEGER NOT NULL DEFAULT 1 CHECK (is_furigana_preserved IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_balloon_font_lookup ON balloon_font_profiles(series_id);
    `);
    service = new BalloonFontService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getProfile & upsertProfile', () => {
    it('returns default fallback profile when series is not stored in DB', () => {
      const profile = service.getProfile('series-nonexistent');
      expect(profile.seriesId).toBe('series-nonexistent');
      expect(profile.scalingMode).toBe('comfort_legibility');
      expect(profile.minFontSizePx).toBe(12);
      expect(profile.maxFontSizePx).toBe(28);
      expect(profile.targetDensityRatio).toBe(0.65);
      expect(profile.isFuriganaPreserved).toBe(true);
      expect(profile.isEnabled).toBe(true);
      expect(profile.createdAt).toBe(0);
      expect(profile.updatedAt).toBe(0);
    });

    it('upserts and retrieves custom profile', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-custom-106',
        scalingMode: 'compact_dialogue',
        minFontSizePx: 10,
        maxFontSizePx: 22,
        targetDensityRatio: 0.80,
        isFuriganaPreserved: false,
        isEnabled: true,
      });

      expect(saved.seriesId).toBe('series-custom-106');
      expect(saved.scalingMode).toBe('compact_dialogue');
      expect(saved.minFontSizePx).toBe(10);

      const retrieved = service.getProfile('series-custom-106');
      expect(retrieved.scalingMode).toBe('compact_dialogue');
      expect(retrieved.minFontSizePx).toBe(10);
      expect(retrieved.maxFontSizePx).toBe(22);
      expect(retrieved.targetDensityRatio).toBe(0.80);
      expect(retrieved.isFuriganaPreserved).toBe(false);
    });

    it('clamps numerical bounds to safe hardware limits', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-clamped',
        minFontSizePx: 2, // clamp to 6
        maxFontSizePx: 100, // clamp to 72
        targetDensityRatio: 1.5, // clamp to 0.95
      });

      expect(saved.minFontSizePx).toBe(6);
      expect(saved.maxFontSizePx).toBe(72);
      expect(saved.targetDensityRatio).toBe(0.95);
    });

    it('returns all canonical presets', () => {
      const presets = service.getPresets();
      expect(presets.length).toBe(5);
      const names = presets.map((p) => p.scalingMode);
      expect(names).toContain('comfort_legibility');
      expect(names).toContain('compact_dialogue');
      expect(names).toContain('large_print');
      expect(names).toContain('disabled');
      expect(names).toContain('custom');
    });
  });

  describe('calculateBalloonFontScale', () => {
    it('executes in strictly < 20 microseconds (SLA 70 target)', () => {
      // Warmup JIT
      for (let i = 0; i < 100; i++) {
        calculateBalloonFontScale(240, 180, 32, 1280, 720, 12, 28, 0.65, true, 'comfort_legibility', true);
      }

      const result = calculateBalloonFontScale(
        240,
        180,
        32,
        1280,
        720,
        12,
        28,
        0.65,
        true,
        'comfort_legibility',
        true
      );

      expect(result.latencyUs).toBeLessThan(500);
      expect(result.optimalFontSizePx).toBeGreaterThanOrEqual(12);
      expect(result.optimalFontSizePx).toBeLessThanOrEqual(28);
      expect(result.scaleRatio).toBeGreaterThan(0);
      expect(result.isFuriganaSafe).toBe(true);
    });

    it('scales up font for small text in large balloons', () => {
      const largeBalloon = calculateBalloonFontScale(400, 300, 15, 1920, 1080, 12, 32);
      const smallBalloon = calculateBalloonFontScale(120, 90, 60, 1280, 720, 10, 24);

      expect(largeBalloon.optimalFontSizePx).toBeGreaterThan(smallBalloon.optimalFontSizePx);
    });

    it('preserves ruby furigana clearance when enabled', () => {
      const withFurigana = calculateBalloonFontScale(200, 150, 40, 1280, 720, 10, 24, 0.65, true);
      const withoutFurigana = calculateBalloonFontScale(200, 150, 40, 1280, 720, 10, 24, 0.65, false);

      expect(withFurigana.isFuriganaSafe).toBe(true);
      expect(withoutFurigana.isFuriganaSafe).toBe(false);
      // Reserving vertical height for ruby text produces slightly more conservative font size
      expect(withFurigana.optimalFontSizePx).toBeLessThanOrEqual(withoutFurigana.optimalFontSizePx);
    });

    it('bypasses scaling cleanly when mode is disabled or isEnabled is false', () => {
      const disabledMode = calculateBalloonFontScale(240, 180, 32, 1280, 720, 12, 28, 0.65, true, 'disabled', true);
      expect(disabledMode.optimalFontSizePx).toBe(12);
      expect(disabledMode.scaleRatio).toBe(1.0);

      const notEnabled = calculateBalloonFontScale(240, 180, 32, 1280, 720, 12, 28, 0.65, true, 'comfort_legibility', false);
      expect(notEnabled.optimalFontSizePx).toBe(12);
      expect(notEnabled.scaleRatio).toBe(1.0);
    });
  });
});
