/**
 * KuraScroll Sprint 89: Adaptive Contrast Dynamic Range & HDR Tone-Mapping Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  DynamicToneService,
  DYNAMIC_TONE_MODES,
  DynamicToneProfile,
} from '../../../../src/backend/services/dynamic-tone-service.js';

describe('DynamicToneService', () => {
  let db: DatabaseInstance;
  let service: DynamicToneService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS dynamic_tone_profiles (
        series_id TEXT PRIMARY KEY,
        gamma_exponent REAL NOT NULL DEFAULT 1.15 CHECK (gamma_exponent >= 0.50 AND gamma_exponent <= 2.50),
        black_point_lift REAL NOT NULL DEFAULT 0.04 CHECK (black_point_lift >= 0.00 AND black_point_lift <= 0.25),
        white_point_compress REAL NOT NULL DEFAULT 0.92 CHECK (white_point_compress >= 0.70 AND white_point_compress <= 1.00),
        ambient_adaptation_mode TEXT NOT NULL DEFAULT 'cinema_night' CHECK (ambient_adaptation_mode IN ('cinema_night', 'daylight_boost', 'oled_pure_black')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dynamic_tone_lookup ON dynamic_tone_profiles(series_id);
    `);
    service = new DynamicToneService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateToneMappingParameters', () => {
    it('computes cinema_night preset parameters correctly', () => {
      const res = service.calculateToneMappingParameters(1.15, 0.04, 0.92, 'cinema_night');
      expect(res.gammaExponent).toBe(1.15);
      expect(res.blackPointLift).toBe(0.04);
      expect(res.whitePointCompress).toBe(0.92);
      expect(res.ambientAdaptationMode).toBe('cinema_night');
      expect(res.contrastPercent).toBeGreaterThan(50);
      expect(res.brightnessPercent).toBeGreaterThan(70);
      expect(res.cssFilterString).toContain('contrast(');
      expect(res.cssFilterString).toContain('brightness(');
    });

    it('enforces ink protection in oled_pure_black mode with zero black lift', () => {
      const res = service.calculateToneMappingParameters(1.0, 0.0, 0.92, 'oled_pure_black');
      expect(res.blackPointLift).toBe(0.0);
      expect(res.ambientAdaptationMode).toBe('oled_pure_black');
    });

    it('clamps out-of-range gamma, lift, and compress parameters', () => {
      const resLow = service.calculateToneMappingParameters(0.1, -0.5, 0.4);
      expect(resLow.gammaExponent).toBe(0.50);
      expect(resLow.blackPointLift).toBe(0.00);
      expect(resLow.whitePointCompress).toBe(0.70);

      const resHigh = service.calculateToneMappingParameters(3.5, 0.5, 1.5);
      expect(resHigh.gammaExponent).toBe(2.50);
      expect(resHigh.blackPointLift).toBe(0.25);
      expect(resHigh.whitePointCompress).toBe(1.00);
    });
  });

  describe('getProfile and setProfile', () => {
    it('returns default cinema_night profile when not found in DB', () => {
      const prof = service.getProfile('series-berserk');
      expect(prof.seriesId).toBe('series-berserk');
      expect(prof.ambientAdaptationMode).toBe('cinema_night');
      expect(prof.gammaExponent).toBe(DYNAMIC_TONE_MODES.cinema_night.gammaExponent);
      expect(prof.blackPointLift).toBe(DYNAMIC_TONE_MODES.cinema_night.blackPointLift);
      expect(prof.whitePointCompress).toBe(DYNAMIC_TONE_MODES.cinema_night.whitePointCompress);
      expect(prof.isEnabled).toBe(true);
      expect(prof.updatedAt).toBe(0);
    });

    it('persists and updates dynamic tone profile with bounds checking', () => {
      const updated = service.setProfile({
        seriesId: 'series-berserk',
        gammaExponent: 1.25,
        blackPointLift: 0.06,
        whitePointCompress: 0.90,
        ambientAdaptationMode: 'oled_pure_black',
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.seriesId).toBe('series-berserk');
      expect(updated.gammaExponent).toBe(1.25);
      expect(updated.blackPointLift).toBe(0.06);
      expect(updated.ambientAdaptationMode).toBe('oled_pure_black');

      const fetched = service.getProfile('series-berserk');
      expect(fetched.seriesId).toBe('series-berserk');
      expect(fetched.gammaExponent).toBe(1.25);
      expect(fetched.ambientAdaptationMode).toBe('oled_pure_black');
    });
  });
});
