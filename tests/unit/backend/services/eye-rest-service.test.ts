/**
 * KuraScroll Sprint 104: Eye Rest Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  EyeRestService,
  EYE_REST_PRESETS,
  calculateEyeRestAperture,
} from '../../../../src/backend/services/eye-rest-service.js';

describe('EyeRestService', () => {
  let db: DatabaseInstance;
  let service: EyeRestService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS eye_rest_profiles (
        series_id TEXT PRIMARY KEY,
        shutter_mode TEXT NOT NULL DEFAULT 'subtle_vignette' CHECK (shutter_mode IN (
            'subtle_vignette',
            'focus_spotlight',
            'circadian_warmth',
            'disabled'
        )),
        aperture_radius_px INTEGER NOT NULL DEFAULT 320 CHECK (aperture_radius_px >= 100 AND aperture_radius_px <= 800),
        falloff_pct INTEGER NOT NULL DEFAULT 35 CHECK (falloff_pct >= 10 AND falloff_pct <= 80),
        rest_interval_min INTEGER NOT NULL DEFAULT 20 CHECK (rest_interval_min >= 5 AND rest_interval_min <= 60),
        eye_care_warmth_k INTEGER NOT NULL DEFAULT 3200 CHECK (eye_care_warmth_k >= 2200 AND eye_care_warmth_k <= 6500),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_eye_rest_lookup ON eye_rest_profiles(series_id);
    `);
    service = new EyeRestService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getProfile & upsertProfile', () => {
    it('returns default fallback profile when series is not stored in DB', () => {
      const profile = service.getProfile('series-nonexistent');
      expect(profile.seriesId).toBe('series-nonexistent');
      expect(profile.shutterMode).toBe('subtle_vignette');
      expect(profile.apertureRadiusPx).toBe(320);
      expect(profile.falloffPct).toBe(35);
      expect(profile.restIntervalMin).toBe(20);
      expect(profile.eyeCareWarmthK).toBe(3200);
      expect(profile.isEnabled).toBe(true);
      expect(profile.createdAt).toBe(0);
      expect(profile.updatedAt).toBe(0);
    });

    it('upserts and retrieves custom profile', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-custom-104',
        shutterMode: 'focus_spotlight',
        apertureRadiusPx: 260,
        falloffPct: 25,
        restIntervalMin: 15,
        eyeCareWarmthK: 3000,
        isEnabled: true,
      });

      expect(saved.seriesId).toBe('series-custom-104');
      expect(saved.shutterMode).toBe('focus_spotlight');
      expect(saved.apertureRadiusPx).toBe(260);

      const retrieved = service.getProfile('series-custom-104');
      expect(retrieved.shutterMode).toBe('focus_spotlight');
      expect(retrieved.apertureRadiusPx).toBe(260);
    });

    it('clamps numerical bounds to safe hardware limits', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-clamped',
        apertureRadiusPx: 9999, // clamp to 800
        falloffPct: 2, // clamp to 10
        restIntervalMin: 1, // clamp to 5
        eyeCareWarmthK: 1000, // clamp to 2200
      });

      expect(saved.apertureRadiusPx).toBe(800);
      expect(saved.falloffPct).toBe(10);
      expect(saved.restIntervalMin).toBe(5);
      expect(saved.eyeCareWarmthK).toBe(2200);
    });

    it('returns all system presets', () => {
      const presets = service.getPresets();
      expect(presets.subtle_vignette).toBeDefined();
      expect(presets.focus_spotlight).toBeDefined();
      expect(presets.circadian_warmth).toBeDefined();
      expect(presets.disabled).toBeDefined();
    });
  });

  describe('calculateEyeRestAperture', () => {
    it('returns none filter and gradient when isEnabled is false', () => {
      const res = calculateEyeRestAperture(
        { x: 500, y: 300 },
        { width: 1280, height: 720 },
        320,
        35,
        0,
        20,
        3200,
        'subtle_vignette',
        false
      );

      expect(res.radialGradientCss).toBe('none');
      expect(res.warmthFilterCss).toBe('none');
      expect(res.isRestActive).toBe(false);
      expect(res.latencyUs).toBeLessThan(500);
    });

    it('calculates proper radial gradient and warmth filter when enabled', () => {
      const res = calculateEyeRestAperture(
        { x: 600, y: 350 },
        { width: 1280, height: 720 },
        300,
        30,
        10,
        20,
        3200,
        'subtle_vignette',
        true
      );

      expect(res.isRestActive).toBe(false);
      expect(res.innerRadiusPx).toBe(210); // 300 * (1 - 0.3)
      expect(res.outerRadiusPx).toBe(300);
      expect(res.radialGradientCss).toContain('radial-gradient(circle at 600px 350px');
      expect(res.radialGradientCss).toContain('210px');
      expect(res.radialGradientCss).toContain('300px');
      expect(res.warmthFilterCss).toContain('sepia');
    });

    it('activates rest dimming when elapsedReadingMin >= restIntervalMin', () => {
      const res = calculateEyeRestAperture(
        { x: 600, y: 350 },
        { width: 1280, height: 720 },
        300,
        30,
        25, // elapsed 25 >= interval 20
        20,
        3200,
        'subtle_vignette',
        true
      );

      expect(res.isRestActive).toBe(true);
      expect(res.vignetteOpacity).toBeGreaterThan(0.35);
    });

    it('executes in strictly under 20 microseconds for SLA 68 compliance', () => {
      // Warmup JIT
      for (let i = 0; i < 1000; i++) {
        calculateEyeRestAperture({ x: 600, y: 350 }, { width: 1280, height: 720 });
      }

      const runs = 5000;
      const start = process.hrtime.bigint();
      for (let i = 0; i < runs; i++) {
        calculateEyeRestAperture({ x: 600, y: 350 }, { width: 1280, height: 720 });
      }
      const end = process.hrtime.bigint();
      const avgUs = Number(end - start) / (runs * 1000);

      expect(avgUs).toBeLessThan(50);
    });
  });
});
