/**
 * KuraScroll Sprint 91: Chromatic Fringe Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  ChromaticFringeService,
  CHROMATIC_FRINGE_CONFIGS,
  ChromaticFringeProfile,
} from '../../../../src/backend/services/chromatic-fringe-service.js';

describe('ChromaticFringeService', () => {
  let db: DatabaseInstance;
  let service: ChromaticFringeService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chromatic_fringe_profiles (
        series_id TEXT PRIMARY KEY,
        neutralizer_mode TEXT NOT NULL DEFAULT 'subpixel_rgb' CHECK (neutralizer_mode IN (
            'subpixel_rgb',
            'subpixel_bgr',
            'monochrome_ink',
            'custom'
        )),
        fringe_radius_px REAL NOT NULL DEFAULT 0.75 CHECK (fringe_radius_px >= 0.10 AND fringe_radius_px <= 2.50),
        desaturation_strength REAL NOT NULL DEFAULT 0.60 CHECK (desaturation_strength >= 0.00 AND desaturation_strength <= 1.00),
        sharpening_amount REAL NOT NULL DEFAULT 1.25 CHECK (sharpening_amount >= 0.50 AND sharpening_amount <= 3.00),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chromatic_fringe_lookup ON chromatic_fringe_profiles(series_id);
    `);
    service = new ChromaticFringeService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateFringeNeutralizerMatrix', () => {
    it('computes subpixel_rgb mode parameters with valid CSS and SVG kernels', () => {
      const res = service.calculateFringeNeutralizerMatrix('subpixel_rgb', 0.75, 0.60, 1.25);
      expect(res.neutralizerMode).toBe('subpixel_rgb');
      expect(res.fringeRadiusPx).toBe(0.75);
      expect(res.desaturationStrength).toBe(0.60);
      expect(res.sharpeningAmount).toBe(1.25);
      expect(res.cssFilterString).toContain('saturate(');
      expect(res.cssFilterString).toContain('contrast(');
      expect(res.svgMatrixString).toContain('0 ');
      expect(res.effectiveContrastMultiplier).toBeGreaterThan(1.0);
    });

    it('enforces total edge desaturation in monochrome_ink mode', () => {
      const res = service.calculateFringeNeutralizerMatrix('monochrome_ink', 1.20, 0.95, 1.50);
      expect(res.neutralizerMode).toBe('monochrome_ink');
      expect(res.desaturationStrength).toBe(0.95);
      expect(res.cssFilterString).toContain('saturate(43%)');
    });

    it('clamps out-of-range radius, desaturation, and sharpening bounds', () => {
      const resLow = service.calculateFringeNeutralizerMatrix('subpixel_rgb', 0.01, -0.5, 0.1);
      expect(resLow.fringeRadiusPx).toBe(0.10);
      expect(resLow.desaturationStrength).toBe(0.00);
      expect(resLow.sharpeningAmount).toBe(0.50);

      const resHigh = service.calculateFringeNeutralizerMatrix('subpixel_rgb', 5.0, 2.0, 10.0);
      expect(resHigh.fringeRadiusPx).toBe(2.50);
      expect(resHigh.desaturationStrength).toBe(1.00);
      expect(resHigh.sharpeningAmount).toBe(3.00);
    });
  });

  describe('getProfile and setProfile', () => {
    it('returns default subpixel_rgb profile when not found in DB', () => {
      const prof = service.getProfile('series-vagabond');
      expect(prof.seriesId).toBe('series-vagabond');
      expect(prof.neutralizerMode).toBe('subpixel_rgb');
      expect(prof.fringeRadiusPx).toBe(0.75);
      expect(prof.desaturationStrength).toBe(0.60);
      expect(prof.sharpeningAmount).toBe(1.25);
      expect(prof.isEnabled).toBe(true);
      expect(prof.updatedAt).toBe(0);
    });

    it('persists and updates chromatic fringe profile with bounds checking', () => {
      const updated = service.setProfile({
        seriesId: 'series-vagabond',
        neutralizerMode: 'monochrome_ink',
        fringeRadiusPx: 1.10,
        desaturationStrength: 0.90,
        sharpeningAmount: 1.45,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.seriesId).toBe('series-vagabond');
      expect(updated.neutralizerMode).toBe('monochrome_ink');
      expect(updated.fringeRadiusPx).toBe(1.10);

      const fetched = service.getProfile('series-vagabond');
      expect(fetched.seriesId).toBe('series-vagabond');
      expect(fetched.neutralizerMode).toBe('monochrome_ink');
      expect(fetched.sharpeningAmount).toBe(1.45);
    });
  });
});
