import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  AmbientBacklightService,
  clampKelvin,
  clampLuminance,
  clampBlueLightRatio,
  calculateCircadianTemperature,
  computeBacklightEtag,
  calculateBacklightTransform,
  CANONICAL_BACKLIGHT_PRESETS,
  DEFAULT_BACKLIGHT_PROFILE,
} from '../../../../src/backend/services/ambient-backlight-service.js';

describe('AmbientBacklightService Unit Tests (Sprint 80)', () => {
  let db: DatabaseInstance;
  let service: AmbientBacklightService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new AmbientBacklightService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Mathematical Normalization & Clamping (BKL-01, 02, 03)', () => {
    it('clamps out-of-bounds Kelvin values strictly to [1800, 6500]', () => {
      expect(clampKelvin(-500)).toBe(1800);
      expect(clampKelvin(0)).toBe(1800);
      expect(clampKelvin(100)).toBe(1800);
      expect(clampKelvin(15000)).toBe(6500);
      expect(clampKelvin(4500)).toBe(4500);
      expect(clampKelvin(NaN)).toBe(6500);
    });

    it('clamps luminance target edge cases strictly to [0.3, 1.5]', () => {
      expect(clampLuminance(0)).toBe(0.3);
      expect(clampLuminance(-1.0)).toBe(0.3);
      expect(clampLuminance(5.0)).toBe(1.5);
      expect(clampLuminance(0.8)).toBe(0.8);
      expect(clampLuminance(NaN)).toBe(1.0);
    });

    it('clamps blue light reduction ratio strictly to [0.0, 0.8]', () => {
      expect(clampBlueLightRatio(-0.5)).toBe(0.0);
      expect(clampBlueLightRatio(1.8)).toBe(0.8);
      expect(clampBlueLightRatio(0.4)).toBe(0.4);
      expect(clampBlueLightRatio(NaN)).toBe(0.0);
    });
  });

  describe('Circadian Rhythm Color Temperature (BKL-04)', () => {
    it('calculates expected circadian temperatures across solar cycle boundaries', () => {
      // 12:00 -> Noon peak daylight (6500K)
      expect(calculateCircadianTemperature(12, 0)).toBe(6500);
      // 18:00 -> Dusk / sunset (3500K)
      expect(calculateCircadianTemperature(18, 0)).toBe(3500);
      // 00:00 -> Midnight (1800K)
      expect(calculateCircadianTemperature(0, 0)).toBe(1800);
      // 06:00 -> Dawn (4000K)
      expect(calculateCircadianTemperature(6, 0)).toBe(4000);
      // 03:00 -> Mid-night deep amber (interpolated)
      const t3 = calculateCircadianTemperature(3, 0);
      expect(t3).toBeGreaterThanOrEqual(1800);
      expect(t3).toBeLessThan(4000);
    });
  });

  describe('Deterministic ETag Calculation (BKL-05)', () => {
    it('generates consistent, deterministic hex ETags', () => {
      const etag1 = computeBacklightEtag(4500, 1.0, 0.25, 'warm_amber');
      const etag2 = computeBacklightEtag(4500, 1.0, 0.25, 'warm_amber');
      const etag3 = computeBacklightEtag(3200, 0.9, 0.45, 'sunset');

      expect(etag1).toBe(etag2);
      expect(etag1).not.toBe(etag3);
      expect(etag1).toMatch(/^"[a-f0-9]+"$/);
    });
  });

  describe('Zero-Allocation Transform Resolution (SLA 44 hot path)', () => {
    it('resolves color multipliers and CSS filters without throwing', () => {
      const res = calculateBacklightTransform(4500, 0.95, 0.25);
      expect(res.kelvin).toBe(4500);
      expect(res.luminance).toBe(0.95);
      expect(res.blueLightReduction).toBe(0.25);
      expect(res.rMultiplier).toBeGreaterThan(0);
      expect(res.gMultiplier).toBeGreaterThan(0);
      expect(res.bMultiplier).toBeGreaterThan(0);
      expect(res.cssFilter).toContain('brightness(');
      expect(res.cssFilter).toContain('sepia(');
      expect(res.matrixValues).toContain('0 0 0 1 0');
    });
  });

  describe('Database Profile Persistence & Defaults', () => {
    it('returns default profile for non-existent series', () => {
      const profile = service.getProfile('unknown-series', 'user-1');
      expect(profile.seriesId).toBe('unknown-series');
      expect(profile.userId).toBe('user-1');
      expect(profile.kelvinTemperature).toBe(6500);
      expect(profile.luminanceTarget).toBe(1.0);
      expect(profile.paperTintMode).toBe('neutral');
      expect(profile.isEnabled).toBe(true);
    });

    it('saves and updates profile with clamping', () => {
      const saved = service.saveProfile({
        seriesId: 'berserk-deluxe',
        userId: 'guts',
        kelvinTemperature: 1200, // Clamped to 1800
        luminanceTarget: 0.1,    // Clamped to 0.3
        blueLightReductionRatio: 0.95, // Clamped to 0.8
        paperTintMode: 'candlelight',
      });

      expect(saved.kelvinTemperature).toBe(1800);
      expect(saved.luminanceTarget).toBe(0.3);
      expect(saved.blueLightReductionRatio).toBe(0.8);
      expect(saved.paperTintMode).toBe('candlelight');

      const retrieved = service.getProfile('berserk-deluxe', 'guts');
      expect(retrieved.kelvinTemperature).toBe(1800);
      expect(retrieved.luminanceTarget).toBe(0.3);
    });

    it('evaluates effective transform with circadian auto toggle', () => {
      const profile = service.getProfile('sololeveling', 'user-1');
      profile.circadianAuto = true;

      // Mock date at noon (12:00)
      const noon = new Date(2026, 10, 2, 12, 0, 0);
      const resNoon = service.getEffectiveTransform(profile, noon);
      expect(resNoon.kelvin).toBe(6500);

      // Mock date at midnight (00:00)
      const midnight = new Date(2026, 10, 2, 0, 0, 0);
      const resMidnight = service.getEffectiveTransform(profile, midnight);
      expect(resMidnight.kelvin).toBe(1800);
    });
  });
});
