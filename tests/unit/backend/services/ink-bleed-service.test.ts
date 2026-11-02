/**
 * KuraScroll Sprint 103: Ink Bleed Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  InkBleedService,
  INK_BLEED_PRESETS,
  calculateInkBleedCompensation,
} from '../../../../src/backend/services/ink-bleed-service.js';

describe('InkBleedService', () => {
  let db: DatabaseInstance;
  let service: InkBleedService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ink_bleed_profiles (
        series_id TEXT PRIMARY KEY,
        compensation_mode TEXT NOT NULL DEFAULT 'vintage_newsprint' CHECK (compensation_mode IN (
            'vintage_newsprint',
            'deep_black_preservation',
            'halftone_clarity',
            'custom'
        )),
        black_point_lift REAL NOT NULL DEFAULT 0.08 CHECK (black_point_lift >= 0.00 AND black_point_lift <= 0.30),
        white_point_compression REAL NOT NULL DEFAULT 0.95 CHECK (white_point_compression >= 0.70 AND white_point_compression <= 1.00),
        gamma_exponent REAL NOT NULL DEFAULT 1.15 CHECK (gamma_exponent >= 0.50 AND gamma_exponent <= 2.50),
        ink_bleed_threshold REAL NOT NULL DEFAULT 0.18 CHECK (ink_bleed_threshold >= 0.05 AND ink_bleed_threshold <= 0.50),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ink_bleed_lookup ON ink_bleed_profiles(series_id);
    `);
    service = new InkBleedService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getProfile & upsertProfile', () => {
    it('returns default fallback profile when series is not stored in DB', () => {
      const profile = service.getProfile('series-nonexistent');
      expect(profile.seriesId).toBe('series-nonexistent');
      expect(profile.compensationMode).toBe('vintage_newsprint');
      expect(profile.blackPointLift).toBe(0.08);
      expect(profile.whitePointCompression).toBe(0.95);
      expect(profile.gammaExponent).toBe(1.15);
      expect(profile.inkBleedThreshold).toBe(0.18);
      expect(profile.isEnabled).toBe(true);
      expect(profile.createdAt).toBe(0);
      expect(profile.updatedAt).toBe(0);
    });

    it('upserts and retrieves custom profile', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-custom-103',
        compensationMode: 'halftone_clarity',
        blackPointLift: 0.12,
        whitePointCompression: 0.92,
        gammaExponent: 1.25,
        inkBleedThreshold: 0.25,
        isEnabled: true,
      });

      expect(saved.seriesId).toBe('series-custom-103');
      expect(saved.compensationMode).toBe('halftone_clarity');
      expect(saved.blackPointLift).toBe(0.12);
      expect(saved.whitePointCompression).toBe(0.92);

      const retrieved = service.getProfile('series-custom-103');
      expect(retrieved.compensationMode).toBe('halftone_clarity');
      expect(retrieved.blackPointLift).toBe(0.12);
    });

    it('clamps numerical bounds to safe hardware limits', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-clamped',
        blackPointLift: 0.99, // clamp to 0.30
        whitePointCompression: 0.20, // clamp to 0.70
        gammaExponent: 5.0, // clamp to 2.50
        inkBleedThreshold: 0.01, // clamp to 0.05
      });

      expect(saved.blackPointLift).toBe(0.30);
      expect(saved.whitePointCompression).toBe(0.70);
      expect(saved.gammaExponent).toBe(2.50);
      expect(saved.inkBleedThreshold).toBe(0.05);
    });

    it('returns all system presets', () => {
      const presets = service.getPresets();
      expect(presets.vintage_newsprint).toBeDefined();
      expect(presets.deep_black_preservation).toBeDefined();
      expect(presets.halftone_clarity).toBeDefined();
      expect(presets.custom).toBeDefined();
    });
  });

  describe('calculateInkBleedCompensation', () => {
    it('returns none filter when isEnabled is false', () => {
      const res = calculateInkBleedCompensation(0.08, 0.95, 1.15, 0.18, 120, 'vintage_newsprint', false);
      expect(res.cssFilterString).toBe('none');
      expect(res.effectiveGamma).toBe(1.0);
      expect(res.contrastMultiplier).toBe(100);
      expect(res.brightnessOffset).toBe(100);
      expect(res.latencyUs).toBeLessThan(500);
    });

    it('calculates proper slope and CSS filter string when enabled', () => {
      // slope = 0.95 - 0.08 = 0.87 -> contrast(87%)
      // intercept = 0.08 -> brightness((1.0 + 0.08 * 0.6) * 100) = brightness(105%)
      const res = calculateInkBleedCompensation(0.08, 0.95, 1.15, 0.18, 120, 'vintage_newsprint', true);

      expect(res.contrastMultiplier).toBe(87);
      expect(res.brightnessOffset).toBe(105);
      expect(res.svgFilterSlope).toBe(0.87);
      expect(res.svgFilterIntercept).toBe(0.08);
      expect(res.cssFilterString).toBe('contrast(87%) brightness(105%)');
      expect(res.effectiveGamma).toBe(1.15);
    });

    it('modulates gamma when ambient lux is elevated (> 200 lux)', () => {
      const resNormal = calculateInkBleedCompensation(0.08, 0.95, 1.15, 0.18, 120);
      const resBright = calculateInkBleedCompensation(0.08, 0.95, 1.15, 0.18, 300);

      expect(resBright.effectiveGamma).toBeGreaterThan(resNormal.effectiveGamma);
    });

    it('executes in strictly under 20 microseconds for SLA 67 compliance', () => {
      // Warmup JIT
      for (let i = 0; i < 50; i++) {
        calculateInkBleedCompensation(0.08, 0.95, 1.15, 0.18, 120);
      }

      const runs = 1000;
      const start = process.hrtime.bigint();
      for (let i = 0; i < runs; i++) {
        calculateInkBleedCompensation(0.08, 0.95, 1.15, 0.18, 120);
      }
      const end = process.hrtime.bigint();
      const avgUs = Number(end - start) / (runs * 1000);

      expect(avgUs).toBeLessThan(20);
    });
  });
});
